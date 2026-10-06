# BUILD-BRIEF.md - myDownloader (written retroactively 07-10-2026)

The build is live and predates the handover packet (`builder` §7.1). This brief records what exists so the next change starts from a stated shape. Gaps found by the 07-10-2026 audit and closed that day are listed at the end.

**Five-line spec.**
1. Who: anyone who wants to keep a video from a public X or TikTok post, first Brian.
2. Job: paste a link, pick a quality, get a file with sound on the device; TikTok without the watermark.
3. Shape: PWA (browser) plus a Cloudflare Worker proxy. **No VM footprint.**
4. Data: none server-side. Download history in `localStorage` only.
5. Not built, on purpose: accounts, storage, YouTube Shorts (removed), photo posts, audio-only.

**Preflight.** Shape PWA · Runs on browser, Cloudflare edge, Firebase Hosting · Data engine none · RAM ceiling a browser tab · Closed tools Firebase Hosting and Cloudflare Workers (exit: any static host; any Worker-compatible runtime or a small Node proxy) · New deps this audit: `@playwright/test` (dev only: the browser gate fails without it).

**Target tree.** `src/` (App, pages, components, `config/`, `hooks/`), `worker/` (`index.js`, `lib/`, `test/`), `tests/smoke.spec.js`, `public/` (icons, fonts, `robots.txt`, `sitemap.xml`, screenshots), `deploy.sh`, `rollback.sh`, `DEPLOY.md`, `CLAUDE.md`, `.pre-commit-config.yaml`, `.github/workflows/gate.yml`.

**Dependencies, and the failure each prevents.** `react`, `react-dom` (the UI) · `lucide-react` (icons) · `clsx`, `tailwind-merge` (class merging in `src/lib/utils.js`) · `tailwindcss`, `@tailwindcss/vite` (styling) · `vite-plugin-pwa` (installable, offline). Removed 07-10-2026 as unused: `axios`, three `@radix-ui/*` packages, `class-variance-authority`.

**Design tokens.** Brand `#237352`; roles `--c-*` in `src/index.css`; Inter Variable self-hosted; cards 18px; pills for buttons; motion reduced when asked. The icon concept: a download arrow dropping into a tray, one glyph ("save it to your device"), `Efforts/myDownloader/brand`.

**Closed on 07-10-2026 (audit against `builder` and `developer`).** Dependencies: 1 critical and 15 high advisories cleared, unused packages removed. Worker: wildcard CORS replaced by an origin list, 60-a-minute per-address limit added, upstream error text no longer returned. Defaults: font size and Auto/Light/Dark added, the Support sheet replaced a single link, Inter self-hosted (Google Fonts removed). Search: robots, sitemap, JSON-LD, real text in the HTML. Headers: CSP and others in `firebase.json`. Process: lint (19 errors to 0), tests (33 to 46 plus 6 browser checks), pre-commit, CI gate, ten-section `DEPLOY.md`, `deploy.sh`, `rollback.sh`.
