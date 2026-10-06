import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';
import { ALLOWED_ORIGINS } from '../lib/cors.js';

const ok = { limit: async () => ({ success: true }) };
const blocked = { limit: async () => ({ success: false }) };
const get = (path, origin) => new Request(`https://w.example${path}`, { headers: origin ? { Origin: origin } : {} });

test('an unknown website is refused before any upstream request', async () => {
  const res = await worker.fetch(get('/download?url=https://video.twimg.com/a.mp4', 'https://evil.example'), { LIMITER: ok });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('the app origins are reflected, never a wildcard', async () => {
  for (const origin of ALLOWED_ORIGINS) {
    const res = await worker.fetch(get('/', origin), { LIMITER: ok });
    assert.equal(res.headers.get('access-control-allow-origin'), origin);
    assert.match(res.headers.get('vary') || '', /Origin/i);
  }
});

test('preflight succeeds for the app and fails for others', async () => {
  const pre = (origin) => new Request('https://w.example/', { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal((await worker.fetch(pre(ALLOWED_ORIGINS[0]), { LIMITER: ok })).status, 204);
  assert.equal((await worker.fetch(pre('https://evil.example'), { LIMITER: ok })).status, 403);
});

test('over the per-address limit returns 429 with a plain message', async () => {
  const res = await worker.fetch(get('/?id=20', ALLOWED_ORIGINS[0]), { LIMITER: blocked });
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /Too many requests/);
});

test('only GET is served', async () => {
  const res = await worker.fetch(new Request('https://w.example/', { method: 'POST' }), { LIMITER: ok });
  assert.equal(res.status, 405);
});

test('upstream text never reaches the visitor', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('connect ECONNREFUSED 10.0.0.9:443 secret-internal-detail'); };
  try {
    const res = await worker.fetch(get('/?id=20', ALLOWED_ORIGINS[0]), { LIMITER: ok });
    assert.equal(res.status, 502);
    assert.doesNotMatch(JSON.stringify(await res.json()), /ECONNREFUSED|secret-internal-detail/);
  } finally { globalThis.fetch = realFetch; }
});
