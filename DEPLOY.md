# DEPLOY.md - myDownloader

Rewritten 07-10-2026 to the ten sections of `builder` §8.1. Two deployables, no VM tenant: a Cloudflare Worker (`worker/`, the proxy) and a Firebase-hosted PWA (`src/`, built by Vite). Deploy the Worker first; the PWA calls it.

## 1. WHAT THIS IS

A free PWA that saves video from public X and TikTok posts to the visitor's device, with sound, TikTok without the watermark. If the Worker stops, nothing resolves or downloads. If the PWA stops, the Worker still answers but nobody can reach it.

X and TikTok only. YouTube Shorts was built, shipped and removed: it needed a `yt-dlp` helper on the user's own machine, so no mobile support and constant upkeep. The last working version is in git history before the rewrite of this file.

| Piece | What it does |
|---|---|
| `worker/index.js` | Origin check, per-address rate limit (60 a minute), router: `/tiktok/*` to TikTok, everything else to X |
| `worker/lib/cors.js` | The origin allowlist. Every response is wrapped here |
| `worker/lib/tiktok.js` | Page-hydration extraction, stateless two-fetch design (the signed media URL is bound to the cookie issued with the page, so `resolve` and `download` each fetch their own) |
| `worker/lib/x.js` | X's syndication API and a Referer/Origin header against `video.twimg.com` |
| `worker/lib/allowlist.js` | The SSRF-safe host allowlist for both providers, re-checked on every redirect |
| `src/` | The PWA: landing, downloader, history, settings, Support sheet |
| `src/config/support.js` | Support values (builder §6.1). The build fails if one is empty |
| `tests/smoke.spec.js` | The browser checks, run against the production bundle with the production CSP |

## 2. PREREQUISITES

- Node 22, npm 10 (`node -v`).
- Chromium for Playwright: `npx playwright install chromium`.
- `firebase` CLI 15 logged in to project `mydownloader-f6a9e` (`firebase login`).
- `wrangler` (in `devDependencies`) logged in to the Cloudflare account that owns `mydownloader-proxy` (`bgkaranja@gmail.com`; `npx wrangler login`). The `brian@gachichio.org` account holds nothing for this Worker.
- `pre-commit` and `gitleaks` for the commit gate: `pre-commit install` once per clone.

## 3. SECRETS

None in this repository. No `.env` file, no API key. Credentials live in the CLIs' own stores: Firebase (`~/.config/configstore/firebase-tools.json`), Cloudflare (`~/.config/.wrangler`). The analytics script is public by design.

Optional build variable: `VITE_WORKER_URL` overrides the Worker address (default: the live Worker).

## 4. FIRST-RUN

```bash
git clone git@github.com:bgachichio/myDownloader.git && cd myDownloader
npm ci
pre-commit install
npm run lint && npm test          # expect 0 errors and 46 passing
npx playwright install chromium
npx playwright test               # expect 6 passing
npm run dev                       # http://localhost:5173, talks to the live Worker
```

`localhost:5173` and `localhost:4173` are on the Worker's origin allowlist, so local runs work.

## 5. BUILD

`npm run build` writes `dist/` (about 1.2 MB, about 3 seconds). The build fails if a Support value is empty.

## 6. DEPLOY

One command, on the Lenovo:

```bash
./deploy.sh
```

It runs the gate (`npm ci`, lint, tests, `npm audit`, build, browser checks), copies the current live site to the Firebase channel `previous`, deploys the Worker (`npx wrangler deploy`), deploys the PWA (`firebase deploy --only hosting`), runs the checks in §7 and rolls the PWA back if any fail.

Manual order if the script cannot run: Worker first, then PWA, then §7.

## 7. VERIFY

`deploy.sh` prints `ok` or `FAIL` for each. By hand:

| Check | Command | Expect |
|---|---|---|
| New page is served | `curl -s https://mydownloader.gachichio.org/ \| grep -c 'saves videos from X and TikTok'` | `1` or more |
| Security headers | `curl -sI https://mydownloader.gachichio.org/ \| grep -i content-security-policy` | a policy naming the Worker and `hi.gachichio.org` |
| Worker, app origin | `curl -s -H 'Origin: https://mydownloader.gachichio.org' 'https://mydownloader-proxy.bgkaranja.workers.dev/?id=20'` | tweet JSON, `access-control-allow-origin` set to that origin |
| Worker, other origin | same with `Origin: https://evil.example` | HTTP 403 |
| TikTok resolves | `curl -s 'https://mydownloader-proxy.bgkaranja.workers.dev/tiktok/resolve?url=https://www.tiktok.com/@scout2015/video/6718335390845095173'` | JSON with a `variants` array |
| Rate limit | 300 quick requests to `/?id=abc` | a share of `429`s |
| Product | An X post and a TikTok link, downloaded on an Android phone and on an iPhone | A file with sound; on iOS the video opens in a new tab |

Search and share gate (`seo` §8, `builder` §6.4), first recorded 07-10-2026: `robots.txt` and `sitemap.xml` served, canonical and Open Graph image set, JSON-LD `SoftwareApplication` present, real text in the HTML before JavaScript runs, one `h1`. Not yet measured: Search Console index count and Lighthouse on mobile; do both after the first week.

Crawler policy: search crawlers allowed, training crawlers blocked (`public/robots.txt`). This is the policy Brian confirmed for myPDF on 01-10-2026, applied here without a separate decision; change both files together if he decides otherwise.

Analytics: the counted hostname is `mydownloader.gachichio.org` (Tally, `hi.gachichio.org`, first-party, no cookies; privacy page at its root). Each screen is a page, Find Video and Download are marked, and a finished download (`downloaded`) is the customer action. The pasted link never reaches Tally.

## 8. ROLLBACK

PWA, one command, about 20 seconds:

```bash
./rollback.sh
```

It clones the `previous` channel (the copy `deploy.sh` kept before the last release) over `live`. **Tested 07-10-2026** (deployed, rolled back, confirmed the previous bundle was served, deployed again).

Worker: `npx wrangler deployments list`, then `npx wrangler rollback <version-id>`. **Not exercised on 07-10-2026**; `wrangler deployments list` shows the earlier versions to return to.

Installed copies of the PWA keep the old bundle until the service worker updates; `registerType: 'autoUpdate'` does that on next launch.

Note: `firebase hosting:releases:list` and `firebase hosting:rollback`, which an earlier version of this file named, do not exist in the Firebase CLI. Use the commands above, or Release history in the Firebase console.

## 9. TROUBLESHOOTING

1. **Every request fails with a CORS error in the browser.** The page's origin is not in `worker/lib/cors.js`. Add it, add a test in `worker/test/cors.test.js`, redeploy the Worker. (Local dev works on ports 5173 and 4173 only.)
2. **429 "Too many requests".** One address made over 60 requests in a minute. Wait a minute. Shared mobile addresses can hit it; raise `limit` in `wrangler.toml` if real users do.
3. **A TikTok link returns "TikTok changed something".** TikTok's private page data changed. `worker/lib/tiktok.js` is the only file to change. The error message names what the payload contained.
4. **TikTok downloads fail with "That media host is not allowed".** TikTok's CDN hostname varies with the requester's network (from Cloudflare the region segment can be missing). Add the case to `worker/test/allowlist.test.js` first, then to the pattern in `worker/lib/allowlist.js`.
5. **A new build shows a blank page or no styles.** The CSP in `firebase.json` blocked something. Open the browser console. If you changed the inline script in `index.html`, its hash in the CSP must change too; `npm test` catches this (`src/config/csp.test.js`).

Known limits: slideshow (photo) TikTok posts are detected but not handled. Private and protected accounts fail with a message. The syndication API is X's embed route, not a supported public API, and can change without notice.

## 10. UNINSTALL

```bash
npx wrangler delete mydownloader-proxy          # the Worker and its rate-limit binding
firebase hosting:disable --project mydownloader-f6a9e
# DNS: delete the mydownloader CNAME/A records for gachichio.org at the registrar
# Analytics: remove mydownloader.gachichio.org from SITES in ~/projects/tally/wrangler.toml, then ./deploy.sh there
```

Nothing else is installed: no VM directory, no PM2 id, no Caddy include, no secret file. Other tenants are untouched.
