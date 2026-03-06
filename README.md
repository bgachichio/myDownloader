# myDownloader

> A zero-cost, zero-backend PWA for downloading X (Twitter) videos — directly to your device.

**Live at:** [mydownloader-f6a9e.web.app](https://mydownloader-f6a9e.web.app)

myDownloader is a Progressive Web App that lets you download videos from X (Twitter) posts in any available quality. Paste a link, pick your resolution, and the video saves straight to your device. There is no server to maintain, no subscription, no sign-in, and no ads — just a fast, private tool that works on Android, iOS, and desktop.

---

## Features

### Downloading
- **Multi-quality selection** — Every resolution X provides is shown (240p up to 1080p HD), sorted best-first. You pick.
- **Duplicate-free quality list** — Deduplicates variants by resolution so the same quality never appears twice.
- **Animated GIF support** — GIFs on X are stored as silent MP4s; myDownloader handles them correctly.
- **Progress indicator** — Real-time download progress bar with percentage, streamed in chunks.

### Privacy & Architecture
- **No backend of your own** — Tweet metadata and video streams are proxied through a single Cloudflare Worker (40 lines of code, free tier).
- **No tracking, no analytics** — Nothing is logged. The Worker reads your request and forwards it; that's it.
- **Download history stored locally** — History lives in `localStorage` on your device only. Clear it any time from Settings.

### Experience
- **Android Share Sheet integration** — Share any X post directly to myDownloader from the X app; the URL auto-populates and lookup begins immediately.
- **Installable PWA** — Add to Home Screen on Android or iOS for a native app feel, including splash screen and standalone mode.
- **iOS-compatible** — On iOS, the video opens in a new tab; long-press → Save to Photos or Download Linked File.
- **Tweet preview** — Thumbnail, author name, handle, and tweet text shown before you download so you always know what you're getting.

### Security (Worker)
- **Strict URL allowlist** — `/download` only proxies `video.twimg.com` — it cannot be abused as a general-purpose proxy.
- **Input validation** — Tweet IDs validated as numeric snowflakes (max 20 digits); video URLs capped at 512 chars and HTTPS-only.
- **Rate limiting** — 60 requests/minute per IP enforced in the Worker.
- **`?tag=` stripping** — X's CDN returns 403 if the `?tag=N` query param is present. The Worker strips it automatically.
- **Correct `Referer` injection** — `video.twimg.com` rejects requests without `Referer: https://x.com/`. The Worker adds this server-side (browsers block setting it manually).

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  PWA — Firebase Hosting                  │
│                                                          │
│   React 19 · Vite 7 · Tailwind CSS 4 · Workbox PWA     │
│                                                          │
│  ┌──────────┐  ┌────────────┐  ┌─────────┐  ┌────────┐ │
│  │  Landing │  │ Downloader │  │ History │  │Settings│ │
│  └──────────┘  └────────────┘  └─────────┘  └────────┘ │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTPS (fetch)
┌───────────────────────────▼──────────────────────────────┐
│              Cloudflare Worker  (free tier)               │
│                                                          │
│  GET /?id=TWEET_ID                                       │
│    └─► cdn.syndication.twimg.com  →  tweet JSON          │
│         (token = deterministic hash of tweet ID)         │
│                                                          │
│  GET /download?url=VIDEO_URL                             │
│    └─► video.twimg.com  (strips ?tag=, injects Referer)  │
│         streams MP4 body straight through, no buffering  │
└───────────────────────────┬──────────────────────────────┘
                            │ direct CDN stream
┌───────────────────────────▼──────────────────────────────┐
│              X (Twitter) Infrastructure                   │
│   cdn.syndication.twimg.com  ·  video.twimg.com CDN      │
│              (X hosts and serves the content)            │
└──────────────────────────────────────────────────────────┘
```

### Why a Worker at all?

X's syndication API and video CDN block direct browser requests via CORS policy and `Referer` enforcement. Every X video downloader on the web runs a server for this reason. The Cloudflare Worker is that server — but it runs at the edge globally, costs nothing on the free tier (100,000 requests/day), and requires no credit card.

### How the syndication API works

X's embed widget (the one that powers tweet previews on third-party websites) calls:

```
GET https://cdn.syndication.twimg.com/tweet-result?id=TWEET_ID&token=TOKEN
```

The token is a **deterministic hash of the tweet ID** — no secret, no OAuth:

```js
token = ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
```

The response contains `mediaDetails[].video_info.variants[]` — an array of direct `video.twimg.com` MP4 URLs at each available resolution.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 19 |
| Build tool | Vite | 7 |
| Styling | Tailwind CSS | 4 |
| Icons | Lucide React | 0.577 |
| PWA / Service Worker | vite-plugin-pwa (Workbox) | 1.2 |
| Edge proxy | Cloudflare Workers | — |
| Hosting | Firebase Hosting | — |

---

## Cloudflare Worker

The Worker (`mydownloader-worker/worker.js`) is the only backend component. It has two routes:

### `GET /?id=TWEET_ID`
Calls X's public syndication API server-side (bypassing CORS), returns the tweet JSON including all video variants. Validates that `id` is a numeric snowflake ID before forwarding.

### `GET /download?url=VIDEO_URL`
Proxies the MP4 stream from `video.twimg.com`. Strips `?tag=N` (which causes 403), injects `Referer: https://x.com/`, and streams the response body through without buffering. Only allows `video.twimg.com` — cannot be used as a general proxy.

---

## Project Structure

```
mydownloader/
├── public/
│   ├── icons/                    # PWA icons, all sizes (72px–512px)
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Topbar.jsx            # App header with branding and menu trigger
│   │   ├── Sidebar.jsx           # Slide-in drawer nav + bottom nav bar
│   │   └── Footer.jsx            # Standard footer + post-download CTA variant
│   ├── pages/
│   │   ├── LandingPage.jsx       # Hero, features, how-it-works sections
│   │   └── OtherPages.jsx        # DownloaderPage, HistoryPage, SettingsPage
│   ├── lib/
│   │   └── api.js                # All API logic: tweet lookup, dedup, download
│   ├── App.jsx                   # Router, share target handler, layout
│   └── main.jsx                  # React entry point
├── vite.config.js                # Vite + PWA manifest + share_target config
└── package.json

mydownloader-worker/
├── worker.js                     # Cloudflare Worker — the entire backend
└── wrangler.toml                 # Worker name and compatibility config
```

---

## Local Development

### Prerequisites
- Node.js 18+
- A deployed Cloudflare Worker (see below) — needed for any actual downloads

### 1. Clone

```bash
git clone https://github.com/bgachichio/myDownloader.git
cd myDownloader
```

### 2. Install

```bash
npm install
```

### 3. Configure the Worker URL

Open `src/lib/api.js` and set `WORKER_URL` to your deployed Worker URL:

```js
const WORKER_URL = 'https://mydownloader-proxy.YOUR-SUBDOMAIN.workers.dev';
```

### 4. Run

```bash
npm run dev
# → http://localhost:5173
```

---

## Deployment

### Frontend (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

### Cloudflare Worker

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) → sign up free (no credit card)
2. Dashboard → Workers & Pages → Create → Hello World starter
3. Replace the entire code with the contents of `mydownloader-worker/worker.js`
4. Name it `mydownloader-proxy` → Save and Deploy
5. Copy your Worker URL (`https://mydownloader-proxy.YOUR-SUBDOMAIN.workers.dev`)
6. Paste it into `src/lib/api.js` as `WORKER_URL`
7. Redeploy the frontend

Alternatively, deploy via Wrangler CLI:

```bash
cd mydownloader-worker
npx wrangler deploy
```

---

## Environment Variables

This project has **no environment variables**. There are no API keys, no secrets, and no `.env` files. The Worker URL is a plain string in `src/lib/api.js` — the Worker itself is unauthenticated and relies on the URL not being publicised (it is a personal tool).

If you fork this and want stricter access control, you can add a static `Authorization` header check in the Worker.

---

## Android Share Sheet

myDownloader registers as a Web Share Target. On Android, after installing the PWA:

1. Open any X post with a video in the X app
2. Tap **Share**
3. Choose **myDownloader** from the share sheet
4. The URL is auto-populated and the lookup begins immediately

This is configured in `vite.config.js` via the `share_target` field in the PWA manifest.

---

## Roadmap

- [x] X (Twitter) video download — all qualities
- [x] Cloudflare Worker proxy (CORS + Referer fix + `?tag=` stripping)
- [x] Android Share Sheet integration
- [x] Download history (localStorage)
- [x] PWA — installable, offline shell, splash screen
- [x] iOS support (new-tab fallback)
- [x] Worker rate limiting + input validation
- [ ] Instagram Reels support
- [ ] TikTok support
- [ ] YouTube support (requires authenticated backend)
- [ ] Audio-only download mode

---

## Contributing

This is a personal project. PRs and issues are welcome — please open an issue first for significant changes.

---

## License

MIT

---

Built by [Brian Gachichio](https://linkedin.com/in/briangachichio) &nbsp;·&nbsp; [X](https://x.com/b_gachichio) &nbsp;·&nbsp; [LinkedIn](https://linkedin.com/in/briangachichio)
