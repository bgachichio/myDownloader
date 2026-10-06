// Frontend gate (frontend-verification): the production bundle, served with the same CSP Firebase sends,
// the Worker mocked, Tally blocked. Run: npm run test:e2e
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

const firebase = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
const csp = firebase.hosting.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
const TWEET = {
  text: 'A short sample clip.', user: { name: 'Sample Account', screen_name: 'sample_account' },
  mediaDetails: [{ type: 'video', media_url_https: 'https://sample.invalid/t.png', video_info: { variants: [
    { content_type: 'video/mp4', bitrate: 2176000, url: 'https://video.twimg.com/a/1280x720/a.mp4' },
    { content_type: 'video/mp4', bitrate: 832000, url: 'https://video.twimg.com/a/640x360/b.mp4' },
  ] } }],
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test.beforeEach(async ({ page }) => {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  errors.length = 0;
  requests.length = 0;
  page.on('request', (r) => requests.push(r.url()));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('hi.gachichio.org')) return route.abort();
    if (url.includes('sample.invalid')) return route.fulfill({ contentType: 'image/png', body: PNG });
    if (url.includes('mydownloader-proxy')) return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(TWEET) });
    const res = await route.fetch();
    return route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } });
  });
});
const errors = [];
const requests = [];

test('loads under the production CSP with no errors and no third-party fonts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Download X and TikTok');
  expect(errors.filter((e) => !/hi\.gachichio\.org|Failed to load resource/.test(e))).toEqual([]);
  expect(requests.some((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toBe(false);
  for (const f of ['/icons/icon-192x192.png', '/icons/icon-maskable-512x512.png', '/icons/apple-touch-icon.png', '/icons/icon.svg', '/og-image.png', '/robots.txt', '/sitemap.xml']) {
    const res = await page.request.get(f);
    expect(res.status(), f).toBe(200);
  }
});

test('the hamburger is there on a phone and opens every destination', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const burger = page.getByRole('button', { name: 'Open menu' });
  await expect(burger).toBeVisible();
  const box = await burger.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await burger.click();
  const drawer = page.locator('aside.drawer');
  for (const name of ['Home', 'Downloader', 'History', 'Settings']) await expect(drawer.getByRole('button', { name })).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Support/ })).toBeVisible();
});

test('a link resolves to a quality picker', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/x\.com/i).first().fill('https://x.com/sample_account/status/1234567890123456789');
  await page.getByRole('button', { name: /download/i }).first().click(); // landing page hands the link to the downloader
  await page.getByRole('button', { name: /find video/i }).click();
  await expect(page.getByText('Sample Account')).toBeVisible();
  await expect(page.getByText('720p').first()).toBeVisible();
});

test('lighting and text size persist, and nothing scrolls sideways at the largest size', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('aside.drawer').getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Dark/ }).click();
  await page.getByRole('button', { name: /Extra large/ }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('ui.fontScale'))).toBe('xlarge');
  expect(await page.evaluate(() => localStorage.getItem('ui.theme'))).toBe('dark');
});

test('Auto follows the device', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('the Support sheet carries the three options, copies, and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Support/ }).first().click();
  const sheet = page.getByRole('dialog', { name: /Support myDownloader/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('gachichio@walletofsatoshi.com')).toBeVisible();
  await expect(sheet.getByText(/^bc1p/)).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Open Paystack/ })).toHaveAttribute('href', 'https://paystack.shop/pay/gachichio');
  await expect(sheet.getByRole('link', { name: 'Open wallet' }).first()).toHaveAttribute('href', /^lightning:/);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});
