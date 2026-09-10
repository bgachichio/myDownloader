// myDownloader Worker entry point.
//
// The X logic is untouched: it moves verbatim into lib/x.js and is called from
// here. TikTok is new and lives entirely in lib/tiktok.js. Adding a provider
// should never require editing a working one.

import * as tiktok from './lib/tiktok.js';
import { handleX } from './lib/x.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

// Upstream failures are the user's problem to understand, not to debug. Map
// them to plain sentences; never leak an upstream body.
function toMessage(err) {
  const m = String(err?.message ?? '');
  if (m.includes('private, deleted')) return { msg: m, status: 404 };
  if (m.includes('page shape')) return { msg: 'TikTok changed something. This needs a fix.', status: 502 };
  if (m.includes('allowlist')) return { msg: 'That media host is not allowed.', status: 400 };
  if (m.includes('too large')) return { msg: 'That file is too large to download here.', status: 413 };
  if (m.includes('CDN returned')) return { msg: 'TikTok refused the download. Try again.', status: 502 };
  return { msg: 'Could not process that link. Try again.', status: 502 };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

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
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      } catch (err) {
        const { msg, status } = toMessage(err);
        return json({ error: msg }, status);
      }
    }

    // Everything else is X, exactly as before: / ?id= and /download?url=
    return handleX(request, url);
  },
};
