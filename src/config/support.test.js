import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORT } from './support.js';
import { isValidBech32m } from './bech32m.js';

test('every support value is present', () => {
  for (const [k, v] of Object.entries(SUPPORT)) assert.ok(v && v.length > 3, `${k} is empty`);
});

test('the on-chain address has a valid bech32m checksum', () => {
  assert.equal(isValidBech32m(SUPPORT.onchain), true);
});

test('a one-character change breaks the checksum', () => {
  const bad = SUPPORT.onchain.slice(0, -1) + (SUPPORT.onchain.endsWith('u') ? 'a' : 'u');
  assert.equal(isValidBech32m(bad), false);
});

test('the links go where they should', () => {
  assert.ok(SUPPORT.paystackUrl.startsWith('https://paystack.shop/'));
  assert.ok(SUPPORT.authorUrl === 'https://x.com/b_gachichio');
  assert.match(SUPPORT.lightning, /^[\w.-]+@[\w.-]+\.[a-z]+$/);
});
