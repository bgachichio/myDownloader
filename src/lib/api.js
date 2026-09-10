// ─── myDownloader · api.js ────────────────────────────────────────────────────
// Every call is proxied through our Cloudflare Worker because the source CDNs
// block the browser directly:
//   X       cdn.syndication.twimg.com blocks CORS; video.twimg.com needs a
//           Referer and a stripped ?tag=
//   TikTok  the signed media URL is bound to the cookie issued with the page,
//           and its CDN pins Access-Control-Allow-Origin to tiktok.com
//
// Override at build time with VITE_WORKER_URL. The default is the live Worker.

const WORKER_URL =
  import.meta.env?.VITE_WORKER_URL?.replace(/\/+$/, '') ||
  'https://mydownloader-proxy.bgkaranja.workers.dev';

// ── Helpers ───────────────────────────────────────────────────────────────────
export function isXUrl(url = '') {
  return /(?:x\.com|twitter\.com)\/.+\/status\/\d+/.test(url.trim());
}

export function isTikTokUrl(url = '') {
  return /(?:^|\/\/)(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\//i.test(url.trim());
}

export function isSupportedUrl(url = '') {
  return isXUrl(url) || isTikTokUrl(url);
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
          return {
            url: v.url,
            downloadUrl: `${WORKER_URL}/download?url=${encodeURIComponent(v.url)}`,
            ext: 'mp4',
            quality, bitrate: v.bitrate || 0, width: w, height: h,
          };
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
    provider: 'x',
    variants, isGif,
    tweetText:    data.text || '',
    authorName:   data.user?.name || '',
    authorHandle: data.user?.screen_name || '',
    thumbnailUrl: data.mediaDetails?.[0]?.media_url_https || null,
  };
}

// ── TikTok: resolve a post to its variants ───────────────────────────────────
export async function fetchTikTokVideo(rawUrl) {
  let res;
  try {
    res = await fetch(`${WORKER_URL}/tiktok/resolve?url=${encodeURIComponent(rawUrl.trim())}`);
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }

  let data;
  try { data = await res.json(); } catch {
    throw new Error('Unexpected response. Try again.');
  }
  if (!res.ok || data.error) {
    throw new Error(data?.error || `Could not fetch that post (${res.status}).`);
  }

  const variants = data.variants.map(v => ({
    quality: v.codec === 'h265' ? `${v.quality} · HEVC` : v.quality,
    bitrate: v.bitrate,
    ext: 'mp4',
    downloadUrl:
      `${WORKER_URL}/tiktok/download?url=${encodeURIComponent(data.pageUrl)}` +
      `&gear=${encodeURIComponent(v.gear)}`,
  }));

  return {
    provider: 'tiktok',
    variants,
    isGif: false,
    tweetText:    data.caption || '',
    authorName:   data.authorName || '',
    authorHandle: data.authorHandle || '',
    thumbnailUrl: data.thumbnailUrl || null,
    mediaId:      data.id,
  };
}

// ── Dispatcher: one entry point for every provider ───────────────────────────
export async function fetchMedia(rawUrl) {
  const url = rawUrl.trim();
  if (isTikTokUrl(url)) return fetchTikTokVideo(url);
  if (isXUrl(url))      return fetchXVideo(url);
  throw new Error('Paste a link from X or TikTok.');
}

// ── Step 2: Download through the Worker ──────────────────────────────────────
// Provider-agnostic: each variant already carries the proxy URL that fetches it.
export async function downloadFile(proxyUrl, filename, onProgress) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (isIOS) {
    // iOS cannot blob-download — open the proxy URL in a new tab instead
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
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error || '';
    } catch { /* not JSON */ }
    throw new Error(detail || `Download failed (${res.status}). Try again.`);
  }

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
