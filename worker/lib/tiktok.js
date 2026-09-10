// TikTok provider. Stateless by design: the signed media URL is bound to the
// session cookie issued with the page, so resolve and download each run their
// own page fetch. Caching the cookie between them would mean per-request state
// at the edge, which the build preflight refuses.
//
// Verified 2026-09-05. See docs/TIKTOK-EXTRACTION.md.

import { validate, MAX_BYTES } from './allowlist.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const HYDRATION =
  /id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/;

export function isTikTokUrl(raw = '') {
  return /(?:^|\/\/)(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\//i.test(raw.trim());
}

function readSetCookie(headers) {
  const all =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie')].filter(Boolean);
  return all
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

// Follows vm.tiktok.com short links and returns { item, cookie }.
// The cookie is only valid for media URLs taken from this same item.
async function loadItem(pageUrl) {
  const res = await fetch(pageUrl, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`TikTok page returned ${res.status}`);

  const cookie = readSetCookie(res.headers);
  const html = await res.text();

  const m = HYDRATION.exec(html);
  if (!m) throw new Error('TikTok changed its page shape - no hydration data');

  const scope = JSON.parse(m[1])?.__DEFAULT_SCOPE__ ?? {};
  const detail = scope['webapp.video-detail'];
  if (!detail) throw new Error('No video data on that page');
  if (detail.statusCode !== 0) {
    throw new Error('That post is private, deleted, or region-locked');
  }

  const item = detail.itemInfo?.itemStruct;
  if (!item) throw new Error('No video data on that page');
  return { item, cookie };
}

// TikTok lists several mirrors per gear and the last one is the www.tiktok.com
// apex, which the allowlist refuses on purpose. Take the first mirror that
// passes; never assume a position in the list.
function firstAllowed(list = []) {
  for (const u of list) {
    if (validate(u)) return u;
  }
  return null;
}

// One entry per downloadable stream. `gear` is the stable key the client
// sends back; it survives the second page fetch because TikTok keys its
// ladder by gear name, not by URL.
function variantsOf(item) {
  const out = [];
  const seen = new Set();

  for (const b of item.video?.bitrateInfo ?? []) {
    const url = firstAllowed(b.PlayAddr?.UrlList);
    const gear = b.GearName;
    if (!url || !gear || seen.has(gear)) continue;
    seen.add(gear);
    // Every TikTok gear is a single progressive file with AAC audio already
    // muxed in. Verified 2026-09-05 with ffprobe on both gears.
    out.push({
      gear,
      quality: qualityLabel(gear, item.video?.height),
      codec: (b.CodecType ?? '').startsWith('h265') ? 'h265' : 'h264',
      bitrate: b.Bitrate ?? 0,
    });
  }

  out.sort((a, b) => {
    if (a.quality !== b.quality) return b.bitrate - a.bitrate;
    if (a.codec !== b.codec) return a.codec === 'h264' ? -1 : 1;
    return b.bitrate - a.bitrate;
  });

  // TikTok ships up to five gears that grade to the same label. Keep the
  // richest of each, as the X path already does, so the picker stays readable.
  const byLabel = new Set();
  const deduped = out.filter((v) => {
    if (byLabel.has(v.quality)) return false;
    byLabel.add(v.quality);
    return true;
  });
  out.length = 0;
  out.push(...deduped);

  // TikTok strips bitrateInfo from the payload it serves to some datacentre
  // egress, Cloudflare included. Observed 2026-09-09: full ladder from a
  // generic datacentre IP, empty ladder from the Worker. playAddr sometimes
  // survives when the ladder does not, so try it before giving up.
  if (!out.length) {
    const single = firstAllowed([item.video?.playAddr].filter(Boolean));
    if (single) {
      out.push({
        gear: 'default',
        quality: item.video?.height ? `${item.video.height}p` : 'Best available',
        codec: (item.video?.codecType ?? '').startsWith('h265') ? 'h265' : 'h264',
        bitrate: item.video?.bitrate ?? 0,
      });
    }
  }

  return out;
}

// Reports what the payload contained when no video variant could be built, so
// a production failure explains itself instead of needing a redeploy to debug.
export function diagnose(item) {
  const pa = item.video?.playAddr;
  let host = null;
  try { host = pa ? new URL(pa).hostname : null; } catch { /* malformed */ }
  return {
    bitrateInfoCount: (item.video?.bitrateInfo ?? []).length,
    hasPlayAddr: Boolean(pa),
    playAddrHost: host,
    playAddrAllowed: pa ? Boolean(validate(pa)) : false,
    hasMusic: Boolean(item.music?.playUrl),
    height: item.video?.height ?? null,
  };
}

function qualityLabel(gear, fallbackHeight) {
  const m = /_(\d{3,4})_/.exec(gear);
  const h = m ? Number(m[1]) : fallbackHeight;
  if (!h) return gear;
  return h >= 1080 ? '1080p HD' : `${h}p`;
}

function mediaUrlFor(item, gear) {
  if (gear === 'default') return firstAllowed([item.video?.playAddr].filter(Boolean));
  for (const b of item.video?.bitrateInfo ?? []) {
    if (b.GearName === gear) return firstAllowed(b.PlayAddr?.UrlList);
  }
  return item.video?.playAddr ?? null;
}

export async function resolve(rawUrl) {
  const { item } = await loadItem(rawUrl);
  const variants = variantsOf(item);
  if (!variants.length) {
    const d = diagnose(item);
    throw new Error(
      'No downloadable video in that post. ' +
      `Payload seen: bitrateInfo=${d.bitrateInfoCount}, playAddr=${d.hasPlayAddr}` +
      `${d.playAddrHost ? ` (${d.playAddrHost}, allowed=${d.playAddrAllowed})` : ''}.`
    );
  }

  return {
    provider: 'tiktok',
    id: item.id,
    pageUrl: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
    variants,
    caption: item.desc ?? '',
    authorName: item.author?.nickname ?? '',
    authorHandle: item.author?.uniqueId ?? '',
    thumbnailUrl: item.video?.cover ?? null,
    durationSeconds: item.video?.duration ?? 0,
  };
}

export async function download(pageUrl, gear) {
  const { item, cookie } = await loadItem(pageUrl);

  const media = mediaUrlFor(item, gear);
  if (!media) throw new Error('That quality is no longer available');

  const checked = validate(media);
  if (!checked) throw new Error('Media host is not on the allowlist');

  const upstream = await fetch(checked, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://www.tiktok.com/',
      Cookie: cookie,
    },
  });

  if (!upstream.ok) {
    throw new Error(`TikTok CDN returned ${upstream.status}`);
  }

  const len = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(len) && len > MAX_BYTES) {
    throw new Error('That file is too large to proxy');
  }

  const handle = item.author?.uniqueId ?? 'tiktok';
  const name = `${handle}-${item.id}.mp4`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': upstream.headers.get('content-length') ?? '',
      'Cache-Control': 'no-store',
    },
  });
}
