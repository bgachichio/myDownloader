// node --test worker/test/allowlist.test.js
// No test dependency added: node:test is built in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, allowedHost } from '../lib/allowlist.js';
import { diagnose } from '../lib/tiktok.js';
import { handleX } from '../lib/x.js';

const allow = [
  ['X video, unchanged from v6.3', 'https://video.twimg.com/ext_tw_video/1/vid/720x1280/a.mp4?tag=12'],
  ['TikTok video, verified host', 'https://v16-webapp-prime.us.tiktok.com/video/tos/useast5/x/'],
  ['TikTok audio, verified host', 'https://v19.tiktokcdn-us.com/abc/6a9b/video/tos/useast5/y'],
  ['prime node prefix rotates', 'https://v19-webapp-prime.us.tiktok.com/video/tos/x'],
  ['prime node region rotates', 'https://v21-webapp-prime.eu.tiktok.com/video/tos/x'],
  ['prime node, no region (Cloudflare egress, confirmed 2026-09-10)', 'https://v16-webapp-prime.tiktok.com/video/tos/x'],
  ['suffix entry, bare apex', 'https://tiktokcdn.com/a'],
  ['suffix entry, subdomain', 'https://v1.eu.tiktokcdn-eu.com/a'],
  ['case is normalised', 'https://V16-WEBAPP-PRIME.US.TIKTOK.COM/a'],
];

const block = [
  ['lookalike parent domain', 'https://tiktokcdn.com.evil.example/a'],
  ['lookalike on the exact host', 'https://v16-webapp-prime.us.tiktok.com.evil.example/a'],
  ['prefixed impostor', 'https://evil-v16-webapp-prime.us.tiktok.com/a'],
  ['substring, not a subdomain', 'https://notvideo.twimg.com/a'],
  ['tiktok apex is not a media host', 'https://www.tiktok.com/@x/video/1'],
  ['tiktok apex, bare', 'https://tiktok.com/a'],
  ['four-node prefix is out of shape', 'https://v1234-webapp-prime.us.tiktok.com/a'],
  ['no region AND out-of-shape node, must still block', 'https://v1234-webapp-prime.tiktok.com/a'],
  ['plaintext', 'http://video.twimg.com/a.mp4'],
  ['credentials in authority', 'https://evil.example@video.twimg.com/a.mp4'],
  ['non-default port', 'https://video.twimg.com:8080/a.mp4'],
  ['not a URL', 'video.twimg.com/a.mp4'],
  ['empty', ''],
  ['wrong type', null],
  ['over the length cap', 'https://video.twimg.com/' + 'a'.repeat(2100)],
  ['unrelated host', 'https://evil.example/a.mp4'],
  ['file scheme', 'file:///etc/passwd'],
  ['internal address', 'https://169.254.169.254/latest/meta-data/'],
];

for (const [name, url] of allow) {
  test(`allow: ${name}`, () => assert.notEqual(validate(url), null, url));
}

for (const [name, url] of block) {
  test(`block: ${name}`, () => assert.equal(validate(url), null, String(url)));
}

test('allowedHost matches host only, never the path', () => {
  assert.equal(allowedHost('evil.example'), false);
  assert.equal(allowedHost('video.twimg.com'), true);
});

// Regression for the payload Cloudflare egress actually receives (verified
// 2026-09-09 against the live Worker): TikTok strips bitrateInfo to an empty
// array for that IP range. diagnose() is what a production 502 explains
// itself with, so it must read the exact shape TikTok sends, not a guess.
test('diagnose: stripped payload, playAddr survives', () => {
  const item = {
    video: {
      playAddr: 'https://v16-webapp-prime.us.tiktok.com/video/tos/x',
      bitrateInfo: [],
      height: 1024,
    },
    music: {},
  };
  const d = diagnose(item);
  assert.equal(d.bitrateInfoCount, 0);
  assert.equal(d.hasPlayAddr, true);
  assert.equal(d.playAddrAllowed, true);
  assert.equal(d.playAddrHost, 'v16-webapp-prime.us.tiktok.com');
});

test('diagnose: nothing survives, still reports why', () => {
  const item = { video: { bitrateInfo: [] }, music: {} };
  const d = diagnose(item);
  assert.equal(d.hasPlayAddr, false);
  assert.equal(d.playAddrAllowed, false);
  assert.equal(d.playAddrHost, null);
});

// Regression for a bug found on recovering the live X source from the
// bgkaranja Cloudflare account (2026-09-10): the validation-failure branch of
// handleTweetLookup called `jsonerr` (lowercase), a name that does not exist.
// A malformed tweet ID threw an uncaught ReferenceError instead of returning
// a 400, which Cloudflare turns into a bare 500 with no CORS headers - the
// browser sees a network error, not an error message. This must return a
// clean 400 and never throw.
test('X: malformed tweet ID returns 400, does not throw', async () => {
  const req = new Request('https://x/?id=not-a-number');
  const res = await handleX(req, new URL(req.url));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Invalid tweet ID');
});

test('X: download route only allows video.twimg.com', async () => {
  const req = new Request('https://x/download?url=https://evil.example/a.mp4');
  const res = await handleX(req, new URL(req.url));
  assert.equal(res.status, 403);
});

test('X: no id and no url returns the usage message, not a crash', async () => {
  const req = new Request('https://x/');
  const res = await handleX(req, new URL(req.url));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /Usage:/);
});
