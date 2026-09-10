# DEPLOY.md — myDownloader v7.0

TikTok support, YouTube Shorts via the local helper, and video+audio only. Two deployables: a Cloudflare Worker and a Firebase-hosted PWA.
Deploy the Worker first — the PWA calls it, and the old PWA works fine against
the new Worker.

---

## 0. The gate — step 5, now run against production

**Step 5 has now been run against the live Worker
(`mydownloader-proxy.bgkaranja.workers.dev`) and it passes** — with one finding
that changes the code in this release.

```
GET /tiktok/resolve?url=…/@scout2015/video/6718335390845095173
→ 200, cookie handshake completes, media streams, 86 771 bytes, valid MP3
```

Cloudflare egress does complete the Akamai handshake. That question is closed.

**What it found instead: TikTok serves Cloudflare's IP range a stripped
payload.** The same video, resolved from a generic datacentre IP, returns a
two-entry bitrate ladder (540p, 720p). Resolved through the Worker, it returns
`bitrateInfo: []` — no video variant at all, audio only. Tested on two separate
videos from two accounts; both stripped identically through Cloudflare.

`worker/lib/tiktok.js` now falls back to `video.playAddr` when the ladder is
empty, labelled `"Best available"` with no quality choice, since that is all
the stripped payload contains. **This has not been proven against the live
Worker** — the deployed Worker still runs the pre-fallback code, because
deploy access here is read-only (see §1). Re-run the check below after
deploying this release.

```bash
curl "https://mydownloader-proxy.bgkaranja.workers.dev/tiktok/resolve?url=https://www.tiktok.com/@scout2015/video/6718335390845095173"
```

Expect a `variants` array containing at least one entry with `"kind"` other
than `"audio"`. If it still comes back audio-only, the fallback's `playAddr` is
also being stripped and `worker/lib/tiktok.js` needs a second look — the error
message it now returns states exactly what the payload contained
(`bitrateInfo=N, playAddr=true/false`), so that second look starts from
evidence, not from guessing again.

`./scripts/verify-egress.sh` still exists and is still worth running after any
future TikTok change — it is the fastest way to catch a regression in the
handshake itself, separate from this payload-shape question.


---

## 1. Worker source — recovered, complete

`worker/lib/x.js` is now in this package, recovered directly from the live
Worker on the `bgkaranja` Cloudflare account via the dashboard's `Edit code`
view (2026-09-10) and reshaped from a bundled default export back into the
`handleX(request, url)` function `worker/index.js` already imports — no
wrapper needed, the deployed source already matched that shape.

**One live bug found and fixed on recovery.** `handleTweetLookup`'s
validation-failure branch called `jsonerr` (lowercase) — a name that exists
nowhere in the file; `jsonErr` does. Every malformed tweet ID hit that branch
and threw an uncaught `ReferenceError`, which Cloudflare turns into a bare 500
with no CORS headers attached — the browser sees a network error, not "invalid
tweet ID". This has been live since whichever of the four `bgkaranja`
deployments introduced it. Fixed, and covered by three new regression tests in
`worker/test/allowlist.test.js` (31/31 passing) — malformed ID returns a clean
400, the download route's host check is confirmed independently, and the
no-parameters case returns the usage message rather than crashing.

**The recovered `tiktok.js`/`allowlist.js` in that same bundle were an older
snapshot** — before the stripped-payload fallback and before audio-only was
removed. This package keeps the current, fixed versions of both; only `x.js`
was taken from the recovery, since it's the one piece that didn't already
exist here.

The account split itself is now understood, not just worked around: `brian@gachichio.org`'s
Cloudflare account (`brian-fc6`, ID `fc6caebac9165f181783f32536505073`) holds
nothing for `mydownloader-proxy` — 404 on every route, confirmed live. The
account actually serving production, the one the live PWA bundle's `WORKER_URL`
points at, is `bgkaranja@gmail.com`'s account (ID `61e4bb7f76dd99e92ec1237aeaa98130`).
Worth adding `brian@gachichio.org` as a member of that account so this
two-identity problem doesn't recur.

Then:

1. Save the recovered source as `worker/lib/x.js`.
2. Change its `export default { async fetch(request, env, ctx) { … } }` into
   `export async function handleX(request, url) { … }`, taking `url` as a
   parameter instead of building it. Nothing else about it changes.
3. Confirm `worker/index.js` imports it — it already expects `./lib/x.js`.
4. Commit all of it. This is the single highest-value thing in this release and
   it is unconditional: do it even if step 5 fails.

---

## 2. What changed

| File | Change |
|---|---|
| `worker/index.js` | **New.** Router. `/tiktok/*` to the new provider, everything else to `handleX` unchanged. |
| `worker/lib/tiktok.js` | **New.** Page hydration extraction, quality ladder, cookie-bound streaming. |
| `worker/lib/allowlist.js` | **New.** Shared host allowlist for both providers. 26 tests. |
| `worker/lib/x.js` | **Recovered**, not rewritten. See §1. |
| `wrangler.toml` | **New.** The repo never had one. |
| `src/lib/api.js` | TikTok client, `fetchMedia` dispatcher, provider-agnostic `downloadFile`. Real Worker URL replaces the `YOUR-SUBDOMAIN` placeholder. |
| `src/pages/OtherPages.jsx` | Wired to the dispatcher; filename honours `.mp3` for audio. |
| `src/pages/LandingPage.jsx` | Copy. See §3. |
| `index.html`, `vite.config.js`, `package.json` | Copy and manifest. See §3. |
| `server.js` | **Security fix** (§4), plus: real quality ladder from `/api/info`, ffmpeg check in `/api/health`, audio-only removed. |
| `package.json` | `express` and `cors` **added** — `server.js` imported them but they were never declared, so the helper could not run from a clean clone. Adds `npm run server`, `test:worker`, `verify:egress`. |

The X path is not modified anywhere. A TikTok failure cannot take X down.

---

## 3. Copy changes, and two corrections

TikTok is now named everywhere the app describes itself: hero, subhead, pills,
placeholders, how-to steps, `<title>`, meta description, Open Graph, and the PWA
manifest.

Two existing claims were false before this release and are now fixed:

- **"No servers. Downloads go direct from X to your device."** There has always
  been a Cloudflare Worker in the path. Replaced with "Nothing Stored — files
  stream straight through to your device."
- **"Uses X's own public embed API. Zero infrastructure."** Same problem.
  Replaced with "No Sign-In — no account, no tracking, no ads."

The `index.html` meta description also advertised Instagram, Threads and
Substack, none of which were ever implemented. It now names X and TikTok only.

---

## 4. `server.js` — fix this regardless of everything else

`server.js` interpolated `req.body.url` into a shell string passed to `exec`,
at `/api/info` and `/api/download`. A URL containing a quote and `$( )` ran
arbitrary commands. `app.use(cors())` allowed every origin, so any page open in
your browser could reach `localhost:3001` and use it.

Fixed by switching to `execFile` with argument arrays and an `--` terminator,
adding an `isHttpUrl` check before yt-dlp is reached, and restricting CORS to
localhost. This is independent of TikTok and should land even if step 5 fails.

---

## 5. Deploy

```bash
# Worker first
npx wrangler deploy
curl "https://mydownloader-proxy.brian-fc6.workers.dev/tiktok/resolve?url=https://www.tiktok.com/@scout2015/video/6718335390845095173"

# PWA second
npm ci
npm run build
npx firebase deploy --only hosting
```

Verify in this order:

0. `npm run server` in a second terminal if you are testing YouTube.
1. An X post still resolves and downloads. **If this broke, roll back now.**
2. A TikTok link resolves and shows a quality list plus "Audio only (MP3)".
3. Download the top quality. Play it. Confirm no watermark.
4. A YouTube Shorts link shows a quality list; download one and confirm it has sound.
5. Share a TikTok post from the TikTok app via the Android share sheet.
6. On iOS, confirm the download opens in a new tab rather than failing silently.

---

## 6. Rollback

**Worker** — Cloudflare keeps every previous version.

```bash
npx wrangler deployments list
npx wrangler rollback --message "v7.0 TikTok regression"
```

**PWA** — Firebase Hosting keeps prior releases.

```bash
npx firebase hosting:releases:list
npx firebase hosting:rollback
```

**Service worker caveat.** Installed PWAs hold the old bundle until Workbox
updates. A rollback is not visible to an installed client until it reloads
twice, so verify a rollback in a private window, not on your installed copy.

Rolling back the Worker alone is safe: the previous Worker has no `/tiktok/*`
routes, so TikTok lookups fail with a clear error while X keeps working.

**This rollback has not been executed.** Run `wrangler deployments list` once
before you deploy, so you know the version you are returning to.

---

## 7. YouTube Shorts — why it does not run on the Worker

I tested this before writing any code, and the answer is no.

**YouTube blocks datacentre IPs.** yt-dlp 2026.08.19 — the reference
implementation — failed from this egress with "Sign in to confirm you're not a
bot." The plain watch page returned `LOGIN_REQUIRED`; the `IOS` and `ANDROID`
InnerTube clients returned empty payloads; `TVHTML5` returned an outright error.
Cloudflare Workers egress from datacentre IPs, so a Worker gets the same wall.

**YouTube does not serve muxed video above 360p.** Everything better arrives as
separate video-only and audio-only tracks that must be joined with ffmpeg. A
Worker cannot run ffmpeg. So on the Worker you may have quality options or you
may have sound, never both.

Either fact alone rules the Worker out. Together they are not worth arguing with.

**What ships instead:** YouTube routes to `server.js`, the yt-dlp helper already
in this repo, running on your own machine and your own IP, with ffmpeg doing the
muxing. `npm run server`, then paste a Shorts link. The app checks
`/api/health` first and says plainly what is missing if the helper or ffmpeg is
absent. X and TikTok are unaffected and still need nothing local.

**The cost, stated plainly:** YouTube does not work on your phone unless the
helper is reachable from it. X and TikTok do. If YouTube-on-mobile matters more
than the constraint, the only honest routes are a residential proxy or stored
YouTube cookies — the first costs money, the second puts a credential in the
system, and I would refuse to write the second.

---

## 8. Video and audio, always — and always with quality options

| Provider | Muxed? | Evidence | Quality options |
|---|---|---|---|
| X | Yes | Progressive MP4 renditions; the shipped app has always saved one file with sound | 240p to 1080p HD, as X provides |
| TikTok | Yes | `ffprobe` on both gears: H.264/HEVC video **plus AAC audio** in one file | 540p (H.264) and 720p (HEVC), labelled |
| YouTube | Yes | yt-dlp `bestvideo+bestaudio --merge-output-format mp4`, ffmpeg presence enforced at `/api/health` | Real ladder read from the video's own formats |

**Audio-only is gone everywhere.** The TikTok "Audio only (MP3)" option is
removed, `server.js` no longer accepts `mode=audio`, and its `-x` extraction
path is deleted. Audio-only formats that exist upstream are filtered out before
the picker is built.

**One TikTok caveat worth seeing.** The 720p gear is HEVC, which will not play
on every Android build and needs a paid extension on Windows. It is labelled
`720p · HEVC`, and at equal quality H.264 now sorts first.

---

## 9. Known limits

- **Slideshow posts are untested.** `imagePost` is detected but no photo carousel
  is handled; such a post returns "No downloadable video in that post."
- **Two page fetches per download.** The signed URL is bound to the cookie issued
  with the page, so `resolve` and `download` each fetch their own. Caching the
  cookie would mean per-request edge state, which the build preflight refuses.
- **Region drift.** Verified against `v16-` and `v19-webapp-prime.us.tiktok.com`.
  The allowlist pattern covers the node family; a genuinely new host family will
  be rejected until it is observed and added deliberately.
- **This is TikTok's private page data, not an API.** It will break without
  notice. `worker/lib/tiktok.js` is the only file that has to change when it does.
