// The security boundary of /download. Everything this returns gets proxied
// from Brian's Worker; everything it rejects is a 400. Widen it carelessly and
// the Worker becomes a free anonymous proxy billed to his account.

const EXACT = [
  'video.twimg.com',              // X - unchanged from v6.3
  'v16-webapp-prime.us.tiktok.com', // TikTok video, verified 2026-09-05
];

// Matched as `host === entry || host.endsWith('.' + entry)`. Never substring.
const SUFFIX = [
  'tiktokcdn.com',
  'tiktokcdn-us.com',   // audio: v19.tiktokcdn-us.com, verified 2026-09-05
  'tiktokcdn-eu.com',
  'tiktokv.com',
  'tiktokv.us',
  'ttwstatic.com',
  'byteoversea.com',
  'muscdn.com',
];

// TikTok rotates the prime-node prefix (v16, v19, v21) and the region segment
// (us, eu). Anchored at both ends so it matches that node family and nothing
// else - not the tiktok.com apex, not a lookalike parent, not a prefixed
// impostor such as evil-v16-webapp-prime.us.tiktok.com.
// TikTok's region segment depends on the requester's own network location, not
// just the node number: from a US datacentre it's v16-webapp-prime.us.tiktok.com;
// from Cloudflare's edge (confirmed 2026-09-10 via wrangler tail on a live 502)
// the same node comes back as v16-webapp-prime.tiktok.com, no region at all.
// The region, when present, is optional here - not removed - so a lookalike
// still can't smuggle itself into that slot.
const PATTERNS = [
  /^v\d{1,3}-webapp-prime(?:\.[a-z]{2,3})?\.tiktok\.com$/,
];

export const MAX_URL_LENGTH = 2048;
export const MAX_BYTES = 300 * 1024 * 1024;
export const MAX_REDIRECTS = 3;

export function allowedHost(hostname) {
  const h = String(hostname).toLowerCase();
  if (EXACT.includes(h)) return true;
  if (SUFFIX.some((d) => h === d || h.endsWith('.' + d))) return true;
  return PATTERNS.some((p) => p.test(h));
}

// Returns a URL object, or null. Null always means 400 - never a fallback.
export function validate(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_URL_LENGTH) return null;

  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null; // https://evil.example@host/
  if (u.port) return null;
  if (!allowedHost(u.hostname)) return null;

  return u;
}

// An allowlist that checks only the first door is not an allowlist. Every hop
// is re-validated against the same rules.
export async function fetchAllowed(raw, headers) {
  let u = validate(raw);
  if (!u) return { error: 'blocked' };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(u, { headers, redirect: 'manual' });

    if (res.status < 300 || res.status > 399) {
      const len = Number(res.headers.get('content-length'));
      if (Number.isFinite(len) && len > MAX_BYTES) return { error: 'too-large' };
      return { res };
    }

    const location = res.headers.get('location');
    if (!location) return { res };

    u = validate(new URL(location, u).toString());
    if (!u) return { error: 'blocked-redirect' };
  }

  return { error: 'too-many-redirects' };
}
