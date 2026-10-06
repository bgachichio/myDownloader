import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const firebase = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'));
const csp = firebase.hosting.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;

test('the inline theme script is allowed by hash, not by unsafe-inline', () => {
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(inline.length, 1);
  const hash = createHash('sha256').update(inline[0]).digest('base64');
  assert.ok(csp.includes(`'sha256-${hash}'`), 'edit index.html and the CSP hash in firebase.json together');
  assert.doesNotMatch(csp.match(/script-src[^;]*/)[0], /unsafe-inline/);
});

test('the policy names only the hosts the app talks to', () => {
  const connect = csp.match(/connect-src[^;]*/)[0];
  assert.match(connect, /mydownloader-proxy\.bgkaranja\.workers\.dev/);
  assert.match(connect, /hi\.gachichio\.org/);
  assert.doesNotMatch(csp, /fonts\.googleapis|fonts\.gstatic/);
});

test('the page has real text, one h1, a canonical and a sitemap', () => {
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
});
