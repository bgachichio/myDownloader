# myDownloader v7.0 - TikTok Support

**Deployment plan · 4 September 2026 · Brian Gachichio Karanja**
Status: DRAFT - awaiting Stage 0 kill test
Supersedes: nothing. Extends v6.3 (X-only).

---

## 0. The blocker, first

**The extraction route is unproven, and nothing else in this plan matters until it is proven.**

TikTok has no public API that returns a downloadable media URL. `oembed` returns a
thumbnail and an embed blob, not a file. Every SnapTik-class site therefore reads an
undocumented endpoint that ByteDance can change without notice. That endpoint is the
whole product. It is also the only part of this plan I could not test: this build
container's egress proxy refuses `CONNECT` to `tiktok.com` (403), so **no TikTok call
in this document has been executed**. Everything below the extraction contract is
conditional on Stage 0 passing.

So Stage 0 is a 30-minute test that can kill the feature before a line of app code is
written. Edge before infrastructure. If Stage 0 fails, stop - do not build Route B to
avoid admitting Route A died.

---

## 1. Preflight

### BUILD PREFLIGHT

```
Project        : myDownloader v7.0 - TikTok
Shape          : PWA + edge function (no new shape)
Runs on        : browser + Cloudflare Worker free tier - smallest that clears CORS
Data engine    : localStorage only. No rung climbed. No database enters.
New deps       : 1 - vitest (dev only). Names its failure: the host allowlist is the
                 security boundary of this change and an untested allowlist is an
                 open proxy. Zero new runtime dependencies.
Closed tools   : none added. Cloudflare Workers and Firebase Hosting are pre-existing
                 and both are exit-priced below (§9).
RAM ceiling    : n/a - no VM. Worker ceiling is 128 MB per invocation, streaming only.
App slug       : mydownloader
VM footprint   : none - browser only
Coexistence    : n/a - no VM tenant
Isolation      : writes nothing outside the repo and the existing Worker
design.md      : READ - preflight below
developer.md   : READ - G0/G1 stamped below
DEPLOY.md      : NOT YET WRITTEN - Stage 6. Ship blocker until done.
```

### DESIGN PREFLIGHT

```
Surface type     : tool
Primary action   : paste a link, get the file
Density          : comfortable
Token source     : design.md - see §7 defect, tokens are NOT currently wired
Deletions made   : platform picker (never built - the URL identifies the platform)
                   watermark toggle (rejected, §6.4)
                   slideshow→MP4 merge (rejected, §6.5)
Defaults wired   : [ ] font-size toggle   [ ] auto/light/dark   [x] localStorage
```

**Two boxes unticked.** They were unticked before this change and are recorded as
v7.1 debt in §7. They are not smuggled into v7.0.

### GATE STAMPS

```
G0 PASS  - no credential enters this change. TikTok extraction needs no key, no OAuth,
           no cookie. Worker stays unauthenticated. WORKER_URL moves to a build-time
           env var (§7.2) - a public URL, not a secret, but config belongs out of source.
G1 PASS  - Delta-4 = 4. See §2. This is a second platform on a one-platform tool:
           it doubles the app's reach against zero marginal infrastructure.
G2 COND  - conditional on Stage 4. Auto-fail today: the repo has no test framework.
           Cleared by the vitest harness in §5, Stage 4.
G3 PASS  - one dev dependency, pinned, lockfile committed. No runtime dep added.
G4 COND  - conditional on Stage 6. Rollback path designed (§8) but untested until then.
G5 COND  - no alerting exists today. §7.4 records the gap and its one-line fix.
```

Three conditional gates. **None of them may be stamped PASS by assertion.** Each is
cleared by a named stage that produces evidence.

---

## 2. The Three Questions

**Is it necessary?** Yes. Delete TikTok support and myDownloader stays a tool for one
network Brian barely posts to, while the platform his children's generation actually
uses stays unreachable. The failure on deletion is that the app remains a demo.

**Does it have to be done this way?** The simpler option is a self-hosted Cobalt
instance - one Docker container, TikTok support already written and maintained by
someone else. It lost on cost and ops: it needs a VM running permanently for a tool
used a few times a week, and Brian already retreated from exactly that at v5→v6. The
Worker keeps the bill at zero. Cobalt stays documented as Route B (§4.3) and becomes
correct the day Route A breaks twice in a quarter.

**Does it have to take this long?** Six stages, ~7 working hours. The floor is about
4 hours - the extra 3 buy the provider abstraction (§3) and the test harness, both of
which are paid back the first time a third platform is added. The excess is not
weather; it is a deliberate purchase of the next two platforms.

---

## 3. The architectural decision

**Do not add TikTok branches to `api.js`. Replace `api.js` with a provider registry.**

The current `src/lib/api.js` is X-shaped throughout: `isXUrl`, `extractTweetId`,
`fetchXVideo`, `cleanXUrl`, and a `parseVideoVariants` that reads `mediaDetails`. Adding
TikTok as `if/else` inside those functions produces a file where every future platform
costs more than the last. That is a fix, not a system.

```
src/lib/
├── api.js                  thin: dispatch + the one shared download()
└── providers/
    ├── index.js            registry - first adapter whose match() returns true wins
    ├── x.js                existing logic, moved verbatim, behaviour unchanged
    └── tiktok.js           new
```

**Adapter contract** - every provider implements exactly this, and nothing else:

```js
{
  id:        'tiktok',
  label:     'TikTok',
  match(url)     -> boolean,          // is this mine?
  canonical(url) -> string,           // strip trackers, normalise
  async resolve(url) -> {
    variants: [                       // ordered, best first
      { url, kind: 'video'|'audio'|'image', label, quality, bitrate, width, height }
    ],
    author:       { name, handle },
    title:        string,
    thumbnailUrl: string|null,
    filenameBase: string              // 'tiktok_handle_7123456789012345678'
  }
}
```

`DownloaderPage` then knows nothing about any platform. It renders variants and calls
`download()`. Instagram and YouTube become one new file each, plus one registry line.

**This is the Delta-4 claim.** Not "TikTok works" - "the next platform costs one file".

---

## 4. Extraction - the contract

### 4.1 URL forms to accept

| Form | Example | Handling |
|---|---|---|
| Canonical video | `tiktok.com/@user/video/7123456789012345678` | id from path |
| Canonical photo | `tiktok.com/@user/photo/7123456789012345678` | id from path, slideshow |
| Short (mobile) | `vm.tiktok.com/ZMabc123/` | Worker resolves redirect |
| Short (share) | `vt.tiktok.com/ZSabc123/` | Worker resolves redirect |
| Short (`/t/`) | `tiktok.com/t/ZTabc123/` | Worker resolves redirect |
| Legacy mobile | `m.tiktok.com/v/7123456789012345678.html` | id from path |

Aweme IDs are 19-digit numerics. Validate as `/^\d{1,20}$/` before any outbound call - same rule the X path already applies to snowflakes.

Short links **must** resolve in the Worker, not the browser: the redirect target is
opaque to `fetch` under CORS, and following it client-side leaks the user's IP to
ByteDance before they have committed to anything.

### 4.2 Route A - chosen

The Worker calls TikTok's mobile detail endpoint with a mobile user agent and reads the
first item of the returned feed. The fields that matter:

| Need | Field | Note |
|---|---|---|
| Video, no watermark | `video.play_addr.url_list[]` | the actual product |
| Video, watermarked | `video.download_addr.url_list[]` | silent fallback only |
| Bitrate ladder | `video.bit_rate[]` → `play_addr.url_list[]` | populates the quality chips |
| Audio | `music.play_url.url_list[]` | already MP3/M4A - no transcode |
| Slideshow images | `image_post_info.images[]` | see §6.5 |
| Metadata | `desc`, `author.nickname`, `author.unique_id`, `video.cover` | preview card |

`url_list` entries are alternates for the same asset, not qualities. Try them in order;
first 200 wins.

**Why this and not page-scraping.** Reading the hydration JSON out of the TikTok web page
means shipping an HTML parser to the edge and re-writing it every time the page markup
moves. The mobile endpoint returns JSON and breaks less often. Both are undocumented;
one is cheaper to repair.

### 4.3 Route B - documented, not built

Self-hosted Cobalt. Trigger to switch: **Route A breaks twice in one quarter, or stays
broken more than 72 hours.** Cost: one always-on container, a VM, and the zero-cost
claim in the README. Do not pre-build it. Do not let it creep into v7.0.

### 4.4 Route C - rejected

`yt-dlp` behind a Node backend. This is what `server.js` already is (§7.1). It needs
Python, ffmpeg, and a permanently running host to serve a tool used a handful of times
a week. It fails the selection law on "free at Brian's scale" and reverses the entire
v6 architecture. Rejected, and the dead implementation is deleted in Stage 1.

---

## 5. The stages

### Stage 0 - kill test (30 min) · BLOCKING

No app code. From a machine with unfiltered egress:

1. Call the mobile detail endpoint for one public video ID. Confirm HTTP 200 and JSON.
2. Confirm `video.play_addr.url_list[0]` exists.
3. Fetch that URL with `Referer: https://www.tiktok.com/`. Confirm 200 and `video/mp4`.
4. Play the file. **Confirm with your eyes that there is no watermark.**
5. Repeat once from a Cloudflare Worker (`wrangler dev`), not just a laptop - Cloudflare
   egress IPs are treated differently by ByteDance than residential ones. This is the
   step most likely to fail, and the reason to run it before anything is built.
6. Repeat for one slideshow post and one short link.

**Exit criteria.** All six pass → Stage 1. Step 4 fails (watermark present) → the
feature is native-download parity and not worth building; stop. Step 5 fails → Route A
is dead from Cloudflare; either accept Route B's cost or stop.

Record the tested video IDs and the date in `docs/TIKTOK-EXTRACTION.md`. When this
breaks in four months, that file is the difference between a 20-minute repair and a
rebuild.

### Stage 1 - clear the ground (45 min)

1. **Delete `server.js`** (§7.1) and the five unused runtime dependencies (§7.6).
2. **Commit `worker.js` and `wrangler.toml` into this repo** under `worker/`. Today the
   only backend component is not in version control anywhere the README can point to.
   Until this is done the Rebuild test does not have an answer.
3. Move `WORKER_URL` to `import.meta.env.VITE_WORKER_URL` with the current value as
   fallback (§7.2).

Stage 1 ships on its own and is independently revertible. Do it first; it is worth
doing even if Stage 0 kills TikTok.

### Stage 2 - Worker (2 h)

New routes, all additive. The existing `GET /?id=` stays byte-identical so the live
frontend keeps working against the new Worker.

| Route | Does |
|---|---|
| `GET /?id=` | unchanged - X tweet JSON (kept for one release) |
| `GET /x/tweet?id=` | same handler, new canonical path |
| `GET /tiktok/resolve?url=` | expands short links, fetches detail JSON, returns a normalised variant list |
| `GET /download?url=` | shared streaming proxy - **allowlist widened, see §6.1** |

Rate limits: `resolve` 20/min/IP (it costs an upstream call), `download` 60/min/IP
(unchanged). Normalise the variant shape **in the Worker**, not the browser, so a
TikTok schema change is a one-file edge deploy and not an app release.

### Stage 3 - frontend (2 h)

1. `providers/x.js` - move existing logic. No behaviour change. Diff should be a move.
2. `providers/tiktok.js` - new adapter against the contract in §3.
3. `providers/index.js` - registry.
4. `api.js` - reduce to dispatch plus the shared `download()`, which is already
   platform-agnostic and needs only a `Referer` hint per provider.
5. `DownloaderPage` - remove the X-only guard; render whatever variants come back;
   show a detected-platform chip. **One input field, no platform selector.**
6. Copy: `"…supports X (Twitter) posts only"` → `"Paste a link from X or TikTok."`
7. Landing page and Settings: platform row reads `X · TikTok`.

### Stage 4 - tests (1 h) · clears G2

Add `vitest`. Pinned, dev-only. Cover the two paths that can hurt:

- **URL matching** - every form in §4.1 routes to the right adapter; a malformed or
  hostile URL routes to none. Include `tiktok.com.evil.example` and
  `https://x.com@evil.example/status/1` as explicit negatives.
- **Host allowlist** - the table in §6.1, both directions. This is the security
  boundary; it is the reason the dependency is justified at all.

No test on UI rendering. It would cost more than it catches.

### Stage 5 - verify (45 min)

Against the deployed Worker, not `wrangler dev`:

- [ ] X download still works - all qualities, GIF, iOS tab fallback. **Regression first.**
- [ ] TikTok canonical video, no watermark, confirmed visually
- [ ] TikTok short link
- [ ] TikTok audio
- [ ] TikTok slideshow - images download, audio downloads, no crash
- [ ] Deleted / private / region-locked video → a sentence a human understands
- [ ] Android share sheet from the TikTok app populates the field
- [ ] iOS new-tab fallback
- [ ] Lighthouse PWA still installable; bundle growth under 15 kB gzipped
- [ ] `npm run build` clean (verified clean at v6.3 on 4 Sep 2026: 70.42 kB gzipped)

### Stage 6 - ship (30 min) · clears G4

Write `DEPLOY.md` **before** deploying, then follow it from a clean checkout. Order
matters and is not symmetrical:

**Deploy: Worker first, frontend second.** The Worker change is additive, so the live
v6.3 frontend keeps working against it. If the Worker is wrong, roll it back with no
user ever seeing a broken app.

**Rollback: frontend first, Worker second.** `firebase hosting:rollback` returns the
app to v6.3, which only needs the old `/?id=` route - which the new Worker still
serves. The two components roll back independently, in either order, without a
coordinated release. That property is the whole reason `/?id=` is kept.

---

## 6. Security

### 6.1 The open-proxy risk - the one that matters

`/download` currently proxies exactly one host: `video.twimg.com`. TikTok's CDN is a
rotating set of hostnames. **Widening this carelessly turns Brian's Worker into a free
anonymous proxy on a domain that resolves to his account** - bandwidth billed to him,
abuse attributed to him, and Cloudflare's response is to disable the Worker.

The allowlist is a **suffix match on a parsed hostname**, never a substring match on
the URL string:

```
Exact:   video.twimg.com
Suffix:  .tiktokcdn.com  .tiktokcdn-us.com  .tiktokcdn-eu.com
         .tiktokv.com    .tiktokv.us        .ttwstatic.com
         .byteoversea.com  .muscdn.com
```

Validation, in order - any failure is a 400, no exceptions:

1. `new URL(u)` - reject on throw.
2. `protocol === 'https:'`.
3. `!u.username && !u.password` - kills the `https://evil.example@tiktokcdn.com` form.
4. `hostname` lowercased, then `=== entry || endsWith('.' + entry)`.
   Never `includes()`. `includes()` passes `tiktokcdn.com.evil.example`.
5. No non-default port.
6. Length ≤ 2048.

**Redirects.** Fetch with `redirect: 'manual'` and re-validate every hop against the
same list, maximum three. TikTok's CDN redirects routinely, and a followed redirect is
an allowlist that only checks the first door.

**Size cap.** Reject `Content-Length` above 300 MB and stop the stream if it exceeds
that anyway. Pass `Range` through so mobile resume works.

### 6.2 What is not a secret

Nothing here needs a credential. If a future extraction route needs a cookie, session
token, or device ID, that is a **G0 refusal** - it does not go in `worker.js`, and it
does not go in the repo. It goes in `wrangler secret` or the route is abandoned.

### 6.3 Privacy

The Worker sees every URL a user resolves. It logs none of them today. Keep it that
way: no `console.log` of URLs, no analytics, no Logpush on this Worker. The README's
privacy claim must stay true, and a claim that quietly stops being true is worse than
never making it.

### 6.4 Watermark toggle - rejected

Two buttons where one will do. Default to the clean URL; if it is missing or 403s, fall
back to the watermarked one silently and note it in the status line. A user who wanted
the watermark would not be here.

### 6.5 Slideshow → MP4 - out of scope for v7.0

SnapTik merges photo slideshows into a single MP4. That needs ffmpeg. ffmpeg cannot run
in a Cloudflare Worker, and `ffmpeg.wasm` is roughly 25 MB - it would triple the bundle
and stall mid-range Android, to serve the rarest post type on the platform.

**v7.0 ships the images individually plus the audio track.** Revisit only if Brian
actually hits the limitation. This is the most expensive 10% of parity with SnapTik and
the least used.

### 6.6 Legal

Downloading for personal use is what the app already does for X; TikTok's terms
disallow it, as X's do. The realistic consequence is being blocked, not sued. Two
things follow, and they are honest rather than defensive: the README should say the
tool is personal, and it should not encourage republishing other people's videos - that is a copyright question that belongs to whoever presses download, not to the tool.
There is no reason for this to gate the build.

---

## 7. Defects found in v6.3

Found while reading the repo for this plan. None was introduced by this change.

### 7.1 `server.js` - command injection · CRITICAL

`server.js:122` builds a shell string and passes it to `exec`:

```js
const cmd = `"${ytdlpPath}" ${formatArgs} -o "${tmpFile}" --no-playlist "${url}"`;
await execAsync(cmd);
```

`url` arrives unvalidated from the query string. A value containing `"` and `$(…)`
executes arbitrary commands as the running user. `execFile` is imported at the top of
the file and never used - the safe tool was on the shelf.

Two further faults in the same handler: `/api/download` returns *the newest* `myd_*`
file in the system temp directory, so two concurrent downloads serve each other's
files; and a failed download leaks its temp file permanently.

It is also **already dead**: it imports `express` and `cors`, and neither is declared in
`package.json`. The file cannot start. Nothing in `src/` references it, and it belongs to
the abandoned Route C.

**Delete it in Stage 1.** Do not fix it - fixing it keeps a backend nobody wants. The
severity rating stands regardless of the fact that it cannot currently run: it sits in
git, it reads as a working local backend, and a single `npm i express cors` from a future
reader turns it back into a listening shell.

### 7.2 `WORKER_URL` is a placeholder in source

`src/lib/api.js:8` reads `https://mydownloader-proxy.YOUR-SUBDOMAIN.workers.dev`. Either
the live deployment is built from something other than this repo, or the live app has
been broken since v6.3 shipped. Either answer is a problem: the repo does not describe
the running system. Move to `VITE_WORKER_URL` in Stage 1 and record the real value in
`DEPLOY.md`. It is a public URL, not a secret - but config still does not belong
hardcoded in a source file.

### 7.3 `worker.js` is not in version control

The README documents `mydownloader-worker/worker.js` as the entire backend. It is not
in this repository. **Rebuild test: destroyed today, restored in how long? Unknown.**
That is the definition of balanced rather than built. Stage 1 fixes it.

### 7.4 The four defaults are missing

No dark mode, no font-size toggle, and every colour is a hardcoded hex inline in JSX.
The Settings page offers only history clearing. This violates the standing rule that
every app Brian owns ships with all four.

**Not fixed in v7.0** - it is a full re-tokenisation of every component and would
swallow the TikTok work. Scheduled as **v7.1**, immediately after. The one-line fix is
the blocking `<head>` script plus `--font-scale`; the work is the several hundred
inline hexes behind it.

### 7.5 No alerting · G5

Nothing tells Brian when extraction breaks. He will find out by trying to download
something. The proportionate fix is not a monitoring stack: it is a scheduled Worker
cron that resolves one known-good video daily and posts to Telegram on failure. Roughly
20 lines. **v7.1.**


### 7.6 Five unused runtime dependencies

Declared in `package.json`, imported nowhere in `src/`:

| Package | Status |
|---|---|
| `axios` | unused - `api.js` uses `fetch` |
| `class-variance-authority` | unused |
| `@radix-ui/react-dialog` | unused |
| `@radix-ui/react-tooltip` | unused |
| `@radix-ui/react-slot` | unused |

(`tailwind-merge` is genuinely used and stays.)

They are the residue of a shadcn/ui scaffold that was never built on. They do not reach
the bundle - Vite tree-shakes what is never imported, which is why v6.3 still gzips to
70.42 kB - but they are five packages Brian is nominally on the hook to patch, five
supply-chain surfaces, and five entries in every future audit. **Remove them in Stage 1.**

Verified by grep across `src/` on 4 September 2026.

---

## 8. Rollback

| Component | Command | Recovery |
|---|---|---|
| Frontend | `firebase hosting:rollback` | < 1 min |
| Worker | `wrangler rollback` | < 1 min |
| Repo | `git revert <sha>` | < 1 min |

**Both rollbacks are tested in Stage 6 before go-live, not assumed.** Deliberately roll
the Worker back once, confirm the app still downloads an X video, roll forward again.
A rollback that has never been run is a hope.

Because the Worker's routes are additive and `/?id=` is preserved, the two components
have no ordering dependency on the way back. Rebuild test: **restored in under 5
minutes**, once §7.3 is closed.

---

## 9. Exits

| Part | Exit |
|---|---|
| Cloudflare Workers | ~200 lines of standard JS. Moves to Deno Deploy, Vercel Edge or a Caddy reverse proxy in an afternoon. |
| Firebase Hosting | Static `dist/`. Any host. Under an hour including DNS. |
| TikTok Route A | Route B (Cobalt) is documented and was previously run in production at v5. |

Nothing here is a landlord.

---

## 10. Entropy ledger

**Removed:** `server.js` (160 lines, one critical RCE, two correctness faults, and two
imports of packages that are not installed). Five unused runtime dependencies. The
X-only assumption threaded through `api.js`. A platform picker that was never built.

**Hardened:** the `/download` allowlist moves from one hardcoded host to a tested,
redirect-aware suffix matcher - a stricter mechanism than the one it replaces, despite
allowing more hosts. `worker.js` enters version control. `WORKER_URL` leaves source.
The repo gains its first tests.

**Saved:** roughly KES 0/month direct - the point is what is *not* spent. Route B is
a VM at ~USD 5/month plus the ops attention that costs more than the money. The
provider abstraction saves an estimated 3 hours on each future platform.

**Cost:** one dev dependency, against five removed - the dependency count falls. About
7 working hours. Roughly 12 kB gzipped of bundle.
One new undocumented upstream that will break without warning - the honest price of
this entire category of tool, and §7.5 is how Brian finds out first rather than last.

**Context:** this run loaded `meta-skills`, `brian`, `building` §0–2, `design` §0 and
§12, `developer` §0, §5 and §13, and `audit`. Not loaded: `consultant`, `process`,
`entrepreneur`, `presentations`, `tender`, and the ~90% of `design.md` covering charts,
motion and component law, none of which this change touches.

---

## 11. Effort

| Stage | Work | Time | Blocking |
|---|---|---|---|
| 0 | Kill test | 0.5 h | **Yes - everything** |
| 1 | Delete `server.js`, commit Worker, env var | 0.75 h | No - ship alone |
| 2 | Worker routes + allowlist | 2 h | Stage 3 |
| 3 | Provider registry + TikTok adapter + UI | 2 h | Stage 5 |
| 4 | Tests | 1 h | G2 |
| 5 | Verification | 0.75 h | Stage 6 |
| 6 | `DEPLOY.md`, deploy, rollback drill | 0.5 h | G4 |
| | **Total** | **7.5 h** | |

Two evenings. Stage 0 is the first 30 minutes and can end it.

---

## Change log

**v1.0 - 4 September 2026 · Nairobi**
Initial plan. Built against `TikTok.md` (SnapTik functional review) and a full read of
myDownloader v6.3. Extraction untested from the build container - TikTok egress blocked
by proxy - which is why Stage 0 exists and blocks everything.
