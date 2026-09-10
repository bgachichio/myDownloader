# DEPLOY.md — myDownloader

Two deployables: a Cloudflare Worker (`worker/`) and a Firebase-hosted PWA
(`src/`, built by Vite). Deploy the Worker first — the PWA calls it directly.

X and TikTok only. YouTube Shorts was built, shipped, and removed — it needed
a local `yt-dlp` helper running on the user's own machine, which meant no
mobile support and real operational upkeep (yt-dlp goes stale, YouTube's
extraction defenses shift). Not worth the weight for a personal tool. If it's
ever wanted again, the last working version is recoverable from git history
before this file's rewrite.

---

## 1. What's here

| Piece | What it does |
|---|---|
| `worker/index.js` | Router: `/tiktok/*` to TikTok, everything else to X |
| `worker/lib/tiktok.js` | Page-hydration extraction, stateless two-fetch design (the signed media URL is bound to the cookie issued with the page, so `resolve` and `download` each fetch their own) |
| `worker/lib/x.js` | X's syndication API + a Referer/Origin spoof against `video.twimg.com` |
| `worker/lib/allowlist.js` | Shared SSRF-safe host allowlist for both providers |
| `worker/test/` | 33 tests, `npm run test:worker` |
| `src/lib/api.js` | Frontend dispatcher — one `fetchMedia()` entry point for both providers |

Both providers always return video with audio already muxed in, in a quality
picker — never audio-only, never a bare link with no resolution choice.

---

## 2. Deploy

```bash
npm ci
npm run test:worker          # expect 33/33
npx wrangler deployments list   # know what you can roll back to, before you need it
npx wrangler deploy
npm run build
firebase deploy --only hosting
```

Verify in this order:

1. An X post resolves and downloads with sound.
2. A TikTok link resolves, shows a quality picker, downloads with sound, no watermark.
3. Share a TikTok or X post from its app via Android's share sheet.
4. On iOS, confirm the download opens in a new tab rather than failing silently.

```bash
curl -s "https://mydownloader-proxy.bgkaranja.workers.dev/tiktok/resolve?url=https://www.tiktok.com/@scout2015/video/6718335390845095173"
curl -s "https://mydownloader-proxy.bgkaranja.workers.dev/?id=20"
```

Both should return real data, not `{"error": "..."}`.

---

## 3. Rollback

```bash
npx wrangler rollback --message "regression"
firebase hosting:releases:list
firebase hosting:rollback
```

Installed PWAs hold the old bundle until the service worker updates —
`registerType: 'autoUpdate'` in `vite.config.js` means this happens
automatically on next launch, but verify a rollback in a private window if
you need to confirm it immediately rather than waiting.

---

## 4. Custom domain (`mydownloader.gachichio.org`)

Nothing to change here. The Worker's CORS is wildcard (`*`) — it's a public
proxy with no origin restriction, so a new domain for the PWA needs no
Worker-side update. The one CORS allowlist that *was* origin-restricted lived
in `server.js`, the YouTube local helper — removed along with it.

---

## 5. Known limits

- **TikTok's CDN hostname varies by the requester's own network location.**
  From a plain datacentre IP it's `v16-webapp-prime.us.tiktok.com`; from
  Cloudflare's edge, the same node can come back as `v16-webapp-prime.tiktok.com`
  — no region segment. The allowlist pattern in `worker/lib/allowlist.js`
  treats the region as optional, not required, to cover both. If TikTok
  changes its CDN naming again, `worker/test/allowlist.test.js` is where to
  add the new case before touching the pattern itself.
- **This is TikTok's private page data, not a public API.** It will break
  without notice. `worker/lib/tiktok.js` is the only file that needs to
  change when it does — the two-fetch design and the allowlist are unrelated
  to the page shape.
- **Slideshow posts are untested.** TikTok's `imagePost` field is detected
  but no photo-carousel format is handled.
