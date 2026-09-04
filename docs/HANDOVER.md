# myDownloader - Session Handover

**Prepared:** 4 September 2026 · Nairobi
**From:** Claude Code session on `bgachichio/myDownloader`
**To:** a fresh Claude chat session, or Brian, or any agent picking this up cold
**Branch:** `claude/tiktok-video-downloads-sjf9ux`
**Companion document:** `docs/TIKTOK-DEPLOYMENT-PLAN.md` - the plan itself. This file is
context; that file is instruction. Read this first, then that.

---

## 0. How to use this file

This is a state transfer, not a summary. It carries three things a summary usually loses:
**what was verified against what was assumed**, **what was rejected and why**, and **what
is still open**. If you only read the deployment plan you will execute the right steps for
reasons you cannot defend when they are challenged.

Nothing here is duplicated from the deployment plan. Where the plan is authoritative, this
file points at it.

---

## 1. The goal

Brian owns **myDownloader**, a PWA that downloads videos from social posts to the device.
It currently supports **X (Twitter) only**. The goal is to add **TikTok**.

### The intent behind the goal

Three things sit underneath it, in order of weight.

1. **Reach.** A downloader that only handles X is a demo. TikTok is where the content
   actually is. This is the difference between a portfolio piece and a tool Brian uses.
2. **The next platform, not this one.** Brian's operating rules value the machine that
   builds the machine over the fix. The real prize is not TikTok working; it is that
   Instagram and YouTube afterwards cost one file each. The architecture decision in §5
   is the actual deliverable.
3. **Zero cost, zero ops, permanently.** Brian has already retreated from a running
   backend once (v5 self-hosted Cobalt on Railway → v6 zero-backend). Any proposal that
   quietly reintroduces an always-on server is a regression, not a feature, however good
   it looks in isolation.

### What is explicitly not the goal

- Not a business. There is no monetisation intent. Brian is not building SnapTik.
- Not feature parity with SnapTik. Parity was examined and partly rejected (§6.3).
- Not a rewrite. v6.3 works; this is an extension.

---

## 2. What happened in this session

1. Brian gave Gemini a prompt: review `snaptik.app` and write its functionality to a
   single file, `TikTok.md`.
2. Brian brought that file here and asked for a **comprehensive deployment plan** to add
   TikTok downloads to myDownloader, to be prepared against his `meta-skills`, `building`
   and `developer` skills.
3. This session read the whole repo, ran the build, probed the network, wrote the plan,
   corrected it against verified facts, and pushed it.

**Output:** `docs/TIKTOK-DEPLOYMENT-PLAN.md`, committed and pushed to
`claude/tiktok-video-downloads-sjf9ux` as commit `34d52ba` (see §9.3 for why the first
attempt was rejected).

**Not done:** no application code was written. This session produced a plan, deliberately.
The reason is §4.

### On the Gemini document

`TikTok.md` is 28 lines and is a **business review, not a technical one**. It covers
SnapTik's value proposition, user loop, features, economics and strategic position. It is
accurate and its strategic read is sound - it correctly identifies that SnapTik has no
moat beyond SEO and speed, and that it lives entirely at ByteDance's tolerance.

**What it does not contain is any extraction mechanism.** It says the backend "accesses
the TikTok server, strips the overlay, and packages the media". That sentence is the whole
engineering problem, unopened. Do not treat `TikTok.md` as a technical specification. Its
genuine value here was scoping: it told us which capabilities exist (no-watermark video,
slideshow-to-MP4, audio extraction) so we could decide which to build and which to refuse.

---

## 3. The product as it stands (v6.3)

All facts in this section were read from the repository or produced by running it on
4 September 2026. Nothing here is recalled or assumed.

| | |
|---|---|
| Repo | `github.com/bgachichio/myDownloader` |
| Version | 6.3.0 |
| Live | `mydownloader-f6a9e.web.app` (Firebase Hosting, project `mydownloader-f6a9e`) |
| Licence | MIT |
| Platforms supported | X (Twitter) only |
| Brand colour | `#237352` (the same green Brian's `design.md` tonal ramp is generated from) |

### Stack

React 19 · Vite 7 · Tailwind CSS 4 · `lucide-react` · `vite-plugin-pwa` (Workbox) ·
Firebase Hosting · one Cloudflare Worker.

### Shape

```
src/
├── main.jsx                 React entry
├── App.jsx                  state-object router (no react-router), share-target handler
├── components/
│   ├── Topbar.jsx           header + drawer trigger
│   ├── Sidebar.jsx          slide-in drawer + BottomNav
│   └── Footer.jsx           standard + post-download variant
├── pages/
│   ├── LandingPage.jsx      hero, features, how-it-works
│   └── OtherPages.jsx       DownloaderPage + HistoryPage + SettingsPage (480 lines)
└── lib/
    ├── api.js               ALL platform logic - X-shaped throughout
    └── utils.js
server.js                    dead yt-dlp backend - see §7.1, delete it
```

Routing is a plain object map in `App.jsx` keyed on `home | downloader | history |
settings`, with `activePage` in `useState`. There is no router library. That is a
reasonable call for four screens and should not be "fixed".

### How v6.3 actually works

1. User pastes an X post URL, or shares one from the Android share sheet (registered as a
   Web Share Target in `vite.config.js`).
2. Frontend calls the Cloudflare Worker at `WORKER_URL?id=<tweetId>`.
3. Worker calls X's **public syndication API** - the endpoint that powers third-party
   tweet embeds. Its `token` parameter is a deterministic function of the tweet ID, not a
   secret and not OAuth. The Worker exists because that endpoint blocks browser CORS.
4. Worker returns tweet JSON. Frontend reads `mediaDetails[].video_info.variants[]`,
   filters to MP4, parses resolution out of the URL path, labels quality, sorts by
   bitrate, and **deduplicates by quality label** (X returns duplicates differing only by
   a `?tag=` value).
5. User picks a quality. Frontend calls `WORKER_URL/download?url=<videoUrl>`.
6. Worker proxies the stream from `video.twimg.com`, **stripping `?tag=`** (which causes
   403) and **injecting `Referer: https://x.com/`** (required, and browsers forbid setting
   it client-side). It streams through without buffering.
7. Frontend assembles the chunks into a Blob and triggers a download, showing progress.
   **On iOS it cannot** - iOS Safari will not blob-download - so it opens the proxy URL in
   a new tab and tells the user to long-press and save.
8. A history entry is written to `localStorage` under `myd_history`, capped at 50.

**Nothing is uploaded. Nothing is logged. There is no account, no key, no database.** That
privacy claim is currently true and §6 of the deployment plan exists partly to keep it
true.

### Verified build state

`npm ci && npx vite build` ran clean on 4 September 2026:

```
dist/assets/index-*.js    225.09 kB │ gzip: 70.42 kB
dist/assets/index-*.css    15.79 kB │ gzip:  4.34 kB
PWA precache: 24 entries, 276.88 KiB
```

Use those as the regression baseline. The plan's bundle budget (under 15 kB gzipped
growth) is measured against them.

### Git history

Five commits on `main`. The arc matters more than the messages:

| | |
|---|---|
| `a3eb8a4` | initial v3 PWA |
| `efc63a3` | v3 + Firebase config |
| `0d31dc3` | **v5 - self-hosted Cobalt on Railway** |
| `890adea` | redesign as an X video downloader |
| `f65c2a4` | v6.3 - icons, quality dedup, security hardening, README |

**Read `0d31dc3` → `890adea` carefully before proposing any backend.** Brian has already
run a hosted extraction service and moved off it. Proposing Cobalt or yt-dlp without
acknowledging that history is proposing something he has already tried and abandoned.

---

## 4. The central problem

**TikTok publishes no API that returns a downloadable media URL.**

`oembed` is public and documented but returns only a thumbnail and an embed blob. Every
site in this category - SnapTik included - therefore reads an **undocumented** endpoint
that ByteDance can change or close without notice. That endpoint is the entire product.
Everything else is a morning's work.

**This session could not test it.** The build container's egress proxy refuses `CONNECT`
to `tiktok.com` with a 403. No TikTok call was executed. Consequently:

> **No claim about TikTok extraction anywhere in the plan or this file rests on evidence.**
> It rests on how this class of endpoint is known to behave. That is a weaker footing and
> is stated as such throughout.

This is why the plan opens with **Stage 0: a blocking 30-minute kill test** that can end
the feature before any code exists. It is not ceremony. Within it, **step 5 is the one
that matters**: repeat the test from a Cloudflare Worker via `wrangler dev`, not just from
a laptop. Cloudflare's egress IPs are treated differently by ByteDance than residential
ones, and a route that works from Nairobi may fail from the edge. If step 5 fails, Route A
is dead and the cost question reopens.

---

## 5. The architecture

### Current - X-shaped

`src/lib/api.js` hardcodes X at every level: `isXUrl`, `extractTweetId`, `cleanXUrl`,
`fetchXVideo`, and a `parseVideoVariants` that reads X's `mediaDetails` structure. There is
no seam. Adding TikTok as `if/else` inside these functions makes every subsequent platform
cost more than the last, which is the opposite of the intent in §1.2.

### Target - provider adapter registry

```
src/lib/
├── api.js                  thin: dispatch + the one shared download()
└── providers/
    ├── index.js            registry - first adapter whose match() returns true wins
    ├── x.js                existing logic, moved verbatim, behaviour unchanged
    └── tiktok.js           new
```

Every provider implements exactly one contract and nothing else:

```js
{
  id:        'tiktok',
  label:     'TikTok',
  match(url)     -> boolean,
  canonical(url) -> string,
  async resolve(url) -> {
    variants: [ { url, kind: 'video'|'audio'|'image', label, quality,
                  bitrate, width, height } ],   // ordered, best first
    author:       { name, handle },
    title:        string,
    thumbnailUrl: string|null,
    filenameBase: string
  }
}
```

`DownloaderPage` then knows about no platform at all. It renders whatever variants come
back and calls the shared `download()`. Instagram and YouTube each become one new file
plus one registry line.

**Two design consequences worth defending:**

- **Normalisation happens in the Worker, not the browser.** When TikTok changes its JSON
  shape, the repair is a one-file edge deploy, not an app release users must receive. This
  is deliberate and is the single most valuable property of the design given §4.
- **One input field. No platform selector.** The URL identifies the platform. A picker
  would be a control that asks the user to restate something the machine already knows.

### Edge - the Cloudflare Worker

| Route | Purpose |
|---|---|
| `GET /?id=` | **unchanged** - X tweet JSON, kept byte-identical for one release |
| `GET /x/tweet?id=` | same handler, new canonical path |
| `GET /tiktok/resolve?url=` | expands short links, fetches detail JSON, returns normalised variants |
| `GET /download?url=` | shared streaming proxy - **the security boundary** |

**Why `/?id=` is preserved.** It makes the Worker change purely additive, which makes the
two components independently deployable and independently rollbackable in either order.
Deploy Worker first, frontend second; roll back frontend first, Worker second. That
asymmetry is the whole reason for the compatibility route and should not be optimised away.

### The one real security risk

Widening `/download` beyond `video.twimg.com`. TikTok's CDN rotates hostnames, so the
allowlist must grow. Done carelessly, **this turns Brian's Worker into a free anonymous
proxy** - his bandwidth, his account, Cloudflare's abuse response.

The mitigation is a **parsed-hostname suffix match, never a substring match on the URL
string**, plus rejection of embedded credentials, non-HTTPS schemes and non-default ports,
plus **redirect re-validation on every hop** (TikTok's CDN redirects routinely, and an
allowlist that only checks the first door is not an allowlist), plus a size cap. The full
six-step rule is §6.1 of the deployment plan. It is also the sole justification for adding
a test dependency to this project.

---

## 6. Decisions, and what lost

Handovers lose rejected options and then relitigate them. These are the four that will
come back.

### 6.1 Extraction route

| | Route | Verdict |
|---|---|---|
| **A** | TikTok's undocumented mobile detail endpoint, called from the existing Worker | **Chosen.** Zero new infrastructure, zero cost, fits what already exists. Fragile by nature - that is the price of the whole category. |
| **B** | Self-hosted Cobalt | **Documented, not built.** Open source, TikTok support already maintained by others. Loses on an always-on VM for a tool used a few times a week, and Brian already abandoned exactly this at v5. **Trigger to reconsider: Route A breaks twice in one quarter, or stays broken beyond 72 hours.** |
| **C** | `yt-dlp` behind a Node backend | **Rejected.** Needs Python, ffmpeg and a permanent host. Reverses the entire v6 architecture. This is what `server.js` already is, and it is being deleted. |

Also rejected: **scraping the TikTok web page's hydration JSON**. It means shipping an HTML
parser to the edge and rewriting it every time the markup moves. Both routes are
undocumented; the JSON endpoint is cheaper to repair.

### 6.2 Watermark toggle - rejected

TikTok exposes both a clean and a watermarked URL. The plan defaults to clean and falls
back silently if it is missing or 403s. No toggle. A user who wanted the watermark would
not be using this app. Two controls where one will do.

### 6.3 Slideshow → MP4 - out of scope for v7.0

SnapTik merges photo slideshows into a single MP4. That needs ffmpeg. **ffmpeg cannot run
in a Cloudflare Worker**, and `ffmpeg.wasm` is roughly 25 MB - it would more than triple
the bundle and stall mid-range Android, to serve the rarest post type on the platform.

v7.0 ships the images individually plus the audio track. This is the most expensive ten
per cent of parity with SnapTik and the least used. Revisit only if Brian actually hits
the limitation, not because a competitor has it.

### 6.4 Dark mode and font-size toggle - deferred to v7.1

Brian's standing rule is that every app he owns ships with four defaults: a four-step
font-size toggle, Auto/Light/Dark following the device, settings in `localStorage`, and
PWA-first. **myDownloader currently satisfies only the last two.** There is no theme
control and no font scaling, and every colour is a hardcoded hex inline in JSX.

This was left out of v7.0 on purpose. Fixing it is a full re-tokenisation of every
component and would swallow the TikTok work entirely. It is recorded as v7.1 debt rather
than folded in quietly. **Do not let a future session smuggle it into the TikTok branch.**

---

## 7. Defect register

Found by reading v6.3. **None was introduced by this work.** All line numbers verified by
grep on 4 September 2026.

### 7.1 `server.js:122` - command injection · CRITICAL

An unvalidated `url` query parameter is interpolated into a shell string and passed to
`exec`. A value containing a quote and `$(…)` executes arbitrary commands as the running
user. `execFile` - the safe call - is imported on line 3 and never used.

Two further faults in the same handler: `/api/download` returns *the newest* `myd_*` file
in the system temp directory, so concurrent downloads serve each other's files; and a
failed download leaks its temp file permanently.

**It is already dead.** It imports `express` and `cors`, and neither is declared in
`package.json`, so it cannot start. Nothing in `src/` references it. It belongs to the
abandoned Route C.

**Delete it. Do not fix it** - fixing it preserves a backend nobody wants. The severity
stands despite it being unrunnable: it sits in git, reads as a working local backend, and
one `npm i express cors` from a future reader turns it back into a listening shell.

### 7.2 `worker.js` is not in version control

The README documents `mydownloader-worker/worker.js` as the entire backend. **It is not in
this repository, or any repository in scope.** Destroyed today, restored in how long?
Unknown. That is the definition of balanced rather than built, and it is the highest
*structural* risk in the project even though §7.1 is the higher severity.

Getting the Worker source into `worker/` in this repo is the first thing that should
happen, ahead of any TikTok work.

### 7.3 `src/lib/api.js:8` - `WORKER_URL` is a placeholder

It reads `https://mydownloader-proxy.YOUR-SUBDOMAIN.workers.dev`. Either the live
deployment is not built from this repo, or the live app has been broken since v6.3 shipped.
**Both answers are a problem: the repo does not describe the running system.**

**This is an open question for Brian - see §8.1.** It is a public URL, not a secret, but
config does not belong hardcoded in source. It moves to `VITE_WORKER_URL`.

### 7.4 Five unused runtime dependencies

`axios`, `class-variance-authority`, `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`,
`@radix-ui/react-slot`. Declared in `package.json`, imported nowhere in `src/`.
(`tailwind-merge` is genuinely used and stays.)

Residue of a shadcn/ui scaffold never built on. They do not reach the bundle - Vite
tree-shakes what is never imported, which is why the gzip figure is still 70.42 kB - but
they are five packages to patch, five supply-chain surfaces, and five lines in every future
audit.

### 7.5 No alerting

Nothing tells Brian when extraction breaks. He finds out by trying to download something.
Given §4, this matters more here than it would elsewhere: Route A **will** break, the only
question is when. The proportionate fix is not monitoring infrastructure - it is a
scheduled Worker cron that resolves one known-good video daily and posts to Telegram on
failure. Roughly twenty lines. Scheduled v7.1.

### 7.6 No test framework

The repo has none. The plan adds `vitest` and covers exactly two things: URL matching
across every accepted form (with hostile negatives such as `tiktok.com.evil.example`) and
the host allowlist in both directions. No UI tests - they would cost more than they catch.

---

## 8. Open questions for Brian

Nobody can answer these from the repository. They block or reshape parts of the plan.

1. **Is the live app currently working?** This determines whether §7.3 is a documentation
   defect or a live outage. Try `mydownloader-f6a9e.web.app` with any X video post. If it
   works, the real `WORKER_URL` exists somewhere outside this repo and needs recovering
   into `DEPLOY.md`.
2. **Where is `worker.js`?** Local disk, Cloudflare dashboard, or lost? If it is only in
   the dashboard, export it before anything else. If it is lost, it must be rewritten from
   the README's description, which is detailed enough to make that feasible but is not the
   same as having the source.
3. **Which Cloudflare account and Worker name?** Needed for `wrangler` and for the Stage 0
   edge test.
4. **Does Brian want v7.1 (four defaults, alerting) planned now or after v7.0 ships?**
   The recommendation is after - but he may prefer one re-tokenisation pass covering both.

---

## 9. State of the work

### 9.1 Delivered

- `docs/TIKTOK-DEPLOYMENT-PLAN.md` - full plan: preflight blocks and gate stamps, the
  Three Questions, extraction contract with every accepted URL form, six staged steps with
  times and blocking dependencies, the security section, the defect register, rollback,
  exits, and an entropy ledger. Roughly 7.5 hours of estimated work across two evenings.
- `docs/HANDOVER.md` - this file.

### 9.2 Not delivered, deliberately

No application code, no Worker code, no `DEPLOY.md`. Stage 0 gates all of it. Writing the
adapter before proving the endpoint would be building the machine before validating the
edge.

### 9.3 One thing to know about the git history

The first push was rejected by GitHub (`GH007`) because the commit used Brian's private
email. It was amended to `bgachichio@users.noreply.github.com`, matching every existing
commit on `main`. **Any future session committing to this repo must use that address.**

---

## 10. Picking this up in Claude chat

### If continuing the build

Read, in order: this file → `docs/TIKTOK-DEPLOYMENT-PLAN.md` → `src/lib/api.js` →
`src/pages/OtherPages.jsx`. Then answer §8 before writing anything.

**Route the work properly.** This is a HEAVY job under Brian's router: `meta-skills` →
`brian` → `building` → `design` → `developer` → `audit`. Print the preflight blocks. The
gate stamps in the plan are `G2`, `G4` and `G5` **conditional**, not passed - they are
cleared by named stages that produce evidence, and must not be stamped by assertion.

**Start at Stage 0.** Not Stage 1, not "just the adapter while we wait". If Stage 0 has
already been run, the result belongs in `docs/TIKTOK-EXTRACTION.md` with the tested video
IDs and the date, because that file is the difference between a twenty-minute repair and a
rebuild when this breaks in four months.

**Stage 1 is worth doing regardless.** Deleting `server.js`, getting `worker.js` into git,
and moving `WORKER_URL` to an env var takes 45 minutes, ships independently, and is correct
even if Stage 0 kills TikTok entirely.

### If the ask is something else

The most likely follow-ups and where they land:

- *"Write the code"* → Stage 0 first. Say so, then do Stage 1 while waiting, since it is
  unconditional.
- *"Do the dark mode too"* → v7.1, separate branch. See §6.4. Do not merge the scopes.
- *"Add Instagram as well"* → after the registry exists, this is genuinely one file. Before
  it exists, it is the same mistake twice.
- *"Is this legal?"* → §6.6 of the plan. Short version: TikTok's terms disallow it as X's
  do, the app already does this for X, the realistic consequence is being blocked rather
  than sued, and the copyright question about republishing belongs to whoever presses
  download rather than to the tool. Not a reason to stop.

### Tone and standards Brian expects

Lead with the insight or the blocker, never a preamble. UK English. Spaced normal dashes,
never em dashes. Show the working. Approve, patch or reject - do not cheer. Close with
**one** next step, not five. Never claim a test that was not run: this session's honesty
about the blocked TikTok probe is load-bearing, and a future session that quietly asserts
the endpoint works has broken the most important rule in the file.

---

## 11. The one next step

**Run Stage 0.** Thirty minutes from a machine with unfiltered egress, then repeated from
`wrangler dev`. It tells Brian whether v7.0 exists at all, and it is the only task in the
plan that cannot be reordered.

---

## Change log

**v1.0 - 4 September 2026 · Nairobi**
Initial handover. Covers the session that produced `docs/TIKTOK-DEPLOYMENT-PLAN.md`:
repository audit of v6.3, the SnapTik functional review supplied as `TikTok.md`, the
provider-registry architecture decision, four rejected alternatives, six defects found in
v6.3, and four open questions. Extraction untested - container egress to TikTok blocked.
