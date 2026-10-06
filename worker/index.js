// myDownloader Worker entry point.
//
// The X logic is untouched: it moves verbatim into lib/x.js and is called from
// here. TikTok is new and lives entirely in lib/tiktok.js. Adding a provider
// should never require editing a working one.

import * as tiktok from './lib/tiktok.js';
import { handleX } from './lib/x.js';
import { originAllowed, withCors } from './lib/cors.js';

// CORS is added once, in withCors (lib/cors.js), around every response.
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Upstream failures are the user's problem to understand, not to debug. Map
// them to plain sentences; never leak an upstream body.
function toMessage(err) {
  console.error('[tiktok]', err?.stack || err?.message || err);
  const m = String(err?.message ?? '');
  if (m.includes('private, deleted')) return { msg: m, status: 404 };
  if (m.includes('page shape')) return { msg: 'TikTok changed something. This needs a fix.', status: 502 };
  if (m.includes('allowlist')) return { msg: 'That media host is not allowed.', status: 400 };
  if (m.includes('too large')) return { msg: 'That file is too large to download here.', status: 413 };
  if (m.includes('CDN returned')) return { msg: 'TikTok refused the download. Try again.', status: 502 };
  return { msg: 'Could not process that link. Try again.', status: 502 };
}

async function route(request) {
    const url = new URL(request.url);

    if (url.pathname === '/tiktok/resolve') {
      const target = url.searchParams.get('url');
      if (!target || !tiktok.isTikTokUrl(target)) {
        return json({ error: 'Paste a tiktok.com link.' }, 400);
      }
      try {
        return json(await tiktok.resolve(target));
      } catch (err) {
        const { msg, status } = toMessage(err);
        return json({ error: msg }, status);
      }
    }

    if (url.pathname === '/tiktok/download') {
      const target = url.searchParams.get('url');
      const gear = url.searchParams.get('gear');
      if (!target || !tiktok.isTikTokUrl(target) || !gear) {
        return json({ error: 'Missing url or gear.' }, 400);
      }
      try {
        const res = await tiktok.download(target, gear);
        return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
      } catch (err) {
        const { msg, status } = toMessage(err);
        return json({ error: msg }, status);
      }
    }

    // Everything else is X, exactly as before: / ?id= and /download?url=
    return handleX(request, url);
}

export default {
  async fetch(request, env) {
    if (!originAllowed(request)) return json({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request);
    if (request.method !== 'GET') return withCors(json({ error: 'Method not allowed' }, 405), request);

    // Per-address ceiling (60 a minute). The proxy streams video, so bandwidth is what an abuser would spend.
    if (env?.LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return withCors(json({ error: 'Too many requests. Wait a minute and try again.' }, 429), request);
    }

    return withCors(await route(request), request);
  },
};
