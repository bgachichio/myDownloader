// ─── myDownloader · api.js ────────────────────────────────────────────────────
// All X calls are proxied through our Cloudflare Worker because:
//   1. cdn.syndication.twimg.com blocks browser CORS requests
//   2. video.twimg.com returns 403 without a valid Referer + without ?tag= stripped
//
// Worker handles both. Update WORKER_URL after deploying worker.js to Cloudflare.

const WORKER_URL = 'https://mydownloader-proxy.YOUR-SUBDOMAIN.workers.dev';

// ── Helpers ───────────────────────────────────────────────────────────────────
export function isXUrl(url = '') {
  return /(?:x\.com|twitter\.com)\/.+\/status\/\d+/.test(url.trim());
}

export function extractTweetId(url = '') {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

function cleanXUrl(url) {
  try {
    const u = new URL(url.trim());
    return `${u.origin}${u.pathname}`;
  } catch { return url.trim(); }
}

// ── Step 1: Fetch tweet metadata via Worker ───────────────────────────────────
async function fetchTweetData(tweetId) {
  let res;
  try {
    res = await fetch(`${WORKER_URL}?id=${tweetId}`);
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }

  if (res.status === 404) throw new Error('Tweet not found — it may have been deleted or the account is private.');
  if (res.status === 403) throw new Error('This tweet is from a protected or private account.');
  if (!res.ok)            throw new Error(`Could not fetch tweet (${res.status}). Try again.`);

  let data;
  try { data = await res.json(); } catch {
    throw new Error('Unexpected response. Try again.');
  }
  if (!data || data.error || data.errors) throw new Error(data?.error || 'Tweet not found or unavailable.');
  return data;
}

// ── Parse video variants ──────────────────────────────────────────────────────
function parseVideoVariants(tweetData) {
  for (const media of (tweetData.mediaDetails || [])) {
    if (media.type === 'video' || media.type === 'animated_gif') {
      const mp4s = (media.video_info?.variants || [])
        .filter(v => v.content_type === 'video/mp4' && v.url)
        .map(v => {
          // Strip query params for clean dimension parsing
          const cleanUrl = v.url.split('?')[0];
          const dim = cleanUrl.match(/\/(\d+)x(\d+)\//);
          const w = dim ? parseInt(dim[1]) : 0;
          const h = dim ? parseInt(dim[2]) : 0;
          let quality;
          if      (h >= 1080) quality = '1080p HD';
          else if (h >= 720)  quality = '720p';
          else if (h >= 480)  quality = '480p';
          else if (h >= 360)  quality = '360p';
          else if (h >= 240)  quality = '240p';
          else if (w > 0)     quality = `${w}×${h}`;
          else                quality = 'SD';
          return { url: v.url, quality, bitrate: v.bitrate || 0, width: w, height: h };
        })
        .sort((a, b) => b.bitrate - a.bitrate);

      // Deduplicate: keep only the first (highest-bitrate) entry per quality label.
      // X sometimes returns two variants at the same resolution with different ?tag= values.
      const seen = new Set();
      const unique = mp4s.filter(v => {
        if (seen.has(v.quality)) return false;
        seen.add(v.quality);
        return true;
      });

      if (unique.length) return { variants: unique, isGif: media.type === 'animated_gif' };
    }
  }
  return { variants: [], isGif: false };
}

// ── Main: resolve X URL → video options ──────────────────────────────────────
export async function fetchXVideo(rawUrl) {
  const url     = cleanXUrl(rawUrl);
  const tweetId = extractTweetId(url);
  if (!tweetId) throw new Error('Invalid X URL. Paste a direct post link — e.g. x.com/user/status/123…');

  const data = await fetchTweetData(tweetId);
  const { variants, isGif } = parseVideoVariants(data);

  if (!variants.length) {
    const hasPhoto = (data.mediaDetails || []).some(m => m.type === 'photo');
    if (hasPhoto) throw new Error('This post only contains photos — no video to download.');
    throw new Error('No video found in this post. It may have been removed.');
  }

  return {
    variants, isGif,
    tweetText:    data.text || '',
    authorName:   data.user?.name || '',
    authorHandle: data.user?.screen_name || '',
    thumbnailUrl: data.mediaDetails?.[0]?.media_url_https || null,
  };
}

// ── Step 2: Download video via Worker proxy ───────────────────────────────────
// Routes through Worker so it can strip ?tag= and send the correct Referer.
export async function downloadVideo(videoUrl, filename, onProgress) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // Build the proxied URL
  const proxyUrl = `${WORKER_URL}/download?url=${encodeURIComponent(videoUrl)}`;

  if (isIOS) {
    // iOS can't blob-download — open the proxy URL in a new tab instead
    window.open(proxyUrl, '_blank');
    return { method: 'tab' };
  }

  onProgress?.(0);
  let res;
  try {
    res = await fetch(proxyUrl);
  } catch {
    throw new Error('Download failed — check your connection and try again.');
  }
  if (!res.ok) throw new Error(`Download failed (${res.status}). Try again.`);

  const total  = parseInt(res.headers.get('Content-Length') || '0', 10);
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress?.(Math.round((received / total) * 95));
  }

  onProgress?.(100);
  const blob    = new Blob(chunks, { type: 'video/mp4' });
  const blobUrl = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = blobUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  return { method: 'blob' };
}
