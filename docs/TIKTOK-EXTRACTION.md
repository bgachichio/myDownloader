# TikTok extraction - Stage 0 result

**Run:** 5 September 2026 · from a Linux container with unfiltered egress
**Against:** `docs/TIKTOK-DEPLOYMENT-PLAN.md` v1.0, Stage 0 steps 1-4 and part of step 6
**Verdict:** Route A is dead. The route the plan rejected passes. v7.0 proceeds, but §4.2, §6.1 and §6.4 of the plan are now wrong and the resolve/download split does not survive.

---

## 0. Verified against assumed

Everything in §1 to §5 was executed and the response recorded. Nothing is recalled.

**Not run:** Stage 0 step 5 (repeat from a Cloudflare Worker via `wrangler dev`). No Cloudflare account was available to this session. **Step 5 remains the kill risk and it is now a larger risk than when the plan was written** - see §6.

**Not run:** slideshow post (step 6). Short link was tested and passes.

**Test video:** `6718335390845095173` (`@scout2015`), public, 10.5 s, 576x1024. Chosen because it is TikTok's own long-standing oembed documentation example, so it is stable and uncontroversial.

---

## 1. Route A - the plan's chosen route - is dead

Plan §4.2 specifies "TikTok's mobile detail endpoint with a mobile user agent". Every variant of it was called with an app user agent and the standard `aid=1180` app parameters:

| Endpoint | Result |
|---|---|
| `api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/` | `429 ratelimit triggered`, then `200` with **0 bytes** |
| `api22-normal-c-useast2a.tiktokv.com/aweme/v1/feed/` | `200`, **0 bytes**, `application/json` |
| `api19-normal-c-useast1a.tiktokv.com/aweme/v1/feed/` | `200`, **0 bytes** |
| `api.tiktokv.com/aweme/v1/feed/` | `200`, **0 bytes** |
| `api22.../aweme/v1/multi/aweme/detail/` | `200`, **0 bytes** |
| `www.tiktok.com/api/item/detail/?itemId=` | `200`, **0 bytes** |

An empty `200` is not an outage and not a rate limit. It is the endpoint answering with an empty envelope because the request carries no device signature. Unsigned callers get a well-formed nothing.

**Consequence:** Route A cannot be built as specified. Signing it means reproducing ByteDance's device attestation, which is a moving target maintained by people whose full-time job it is. That is not a Worker feature; it is a second product. **Reject it, do not attempt it.**

Note also: the field names in plan §4.2 (`video.play_addr.url_list[]`, `music.play_url.url_list[]`) were written from recall, never read. They describe the app API shape, not the shape below. Do not carry them forward.

---

## 2. The page hydration route works

The plan rejected this at §6.1, on the reasoning that it "means shipping an HTML parser to the edge". That reasoning was wrong on the facts. There is no HTML parsing. There is one `<script>` tag containing one JSON document.

```
GET https://www.tiktok.com/@<handle>/video/<id>
```

Returns ~400 kB of HTML containing:

```
<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{ ... }</script>
```

Extraction is one regex for the script body, then `JSON.parse`. The payload survives markup changes because it is data, not layout.

**Verified: the page returns the hydration JSON with no user agent at all.** No app UA, no signature, no cookie needed for the page itself.

### Path to the item

```
__DEFAULT_SCOPE__
  └─ webapp.video-detail
       ├─ statusCode        0 on success
       ├─ statusMsg
       └─ itemInfo.itemStruct
```

### Fields verified present

| Need | Field | Observed |
|---|---|---|
| Clean video URL | `video.playAddr` | 458-char signed URL, no watermark |
| Quality ladder | `video.bitrateInfo[]` | **5 entries**, each with `GearName`, `Bitrate`, `QualityType`, `PlayAddr.UrlList[]` |
| Audio | `music.playUrl` | present, on `v19.tiktokcdn-us.com` |
| Dimensions | `video.width` / `height` / `duration` / `format` | 576 · 1024 · 10 · `mp4` |
| Metadata | `desc`, `author.uniqueId`, `author.nickname` | present |
| Poster | `video.cover`, `originCover`, `dynamicCover` | present |
| Slideshow | `imagePost` | absent on this item - **untested, step 6** |

Observed gear names: `normal_540_0` (2 240 963 bps), `adapt_lower_720_1`, `lower_540_0`, `adapt_540_1`.

### `downloadAddr` is empty

`video.downloadAddr` returned an **empty string**, not a watermarked URL.

**This kills plan §6.4.** The designed behaviour - default to clean, fall back silently to the watermarked URL - has nothing to fall back to. Delete the fallback rather than leaving it as dead design. If `playAddr` fails there is no second URL; the correct behaviour is an error message.

---

## 3. Watermark - step 4 - PASS

Downloaded 2 953 029 bytes. `ffprobe`: H.264 + AAC, 576x1024, 30 fps, 10.495 s, 2.25 Mbps. Valid `ISO Media, MP4 Base Media v1`.

Three frames extracted (n=15, 120, 250) and inspected by eye. **No watermark, no bouncing TikTok logo, no `@handle` overlay, on any frame.** Step 4 passes.

---

## 4. The media URL is session-bound - the finding that changes the architecture

This is the important one, and it was not anticipated anywhere in the plan.

Controlled test. Two independent page fetches, A and B, each with its own cookie jar:

| Request | Result |
|---|---|
| `playAddr` from A + cookies from **A** + Referer | **206**, 50 001 bytes |
| `playAddr` from A + cookies from **B** + Referer | **403** |
| `playAddr` from A + Referer, **no cookies** | **403** |
| `playAddr` from A + cookies from A, **no Referer** | **403** |
| Full GET, cookies from A + Referer | **200**, 2 953 029 bytes |

The cookies issued by the page fetch are `ttwid`, `tt_chain_token` and `tt_csrf_token`, all on `.tiktok.com`. The signed URL is bound to that session. **Referer alone is not enough, and a cookie from a different session is not enough.**

The 403 body is Akamai's, not TikTok's:

```
server: AkamaiGHost
x-cache: TCP_DENIED from a23-53-10-115.deploy.akamaitechnologies.com
access-control-allow-origin: https://www.tiktok.com
<TITLE>Access Denied</TITLE>
```

Two things follow from that header block.

- **The browser can never fetch this URL directly.** `access-control-allow-origin` is pinned to `https://www.tiktok.com`. The Worker must proxy the stream. The plan already does this, so this part survives.
- **Range works.** `206 Partial Content` with the cookie present. Mobile resume survives, and plan §6.1's "pass `Range` through" stays correct.

### Host - the allowlist in plan §6.1 is wrong

Observed video host: **`v16-webapp-prime.us.tiktok.com`**
Observed audio host: `v19.tiktokcdn-us.com`

The plan's allowlist is `.tiktokcdn.com`, `.tiktokcdn-us.com`, `.tiktokcdn-eu.com`, `.tiktokv.com`, `.tiktokv.us`, `.ttwstatic.com`, `.byteoversea.com`, `.muscdn.com`.

**As written it passes the audio and blocks the video.** The video sits on `.tiktok.com` itself.

Adding `.tiktok.com` as a suffix entry is a materially wider grant than any other line on that list - it covers the whole property, not a CDN. Prefer a narrower rule: exact-match the observed prefix pattern (`v` + digits + `-webapp-prime` + region + `.tiktok.com`) or, if that proves brittle across regions, `.us.tiktok.com` and its siblings rather than the bare apex. Decide this with the six-step validation in §6.1 intact; every other step of it stands unchanged and correct.

---

## 5. Short links - PASS

`https://vm.tiktok.com/ZMhqLmYNs/` followed redirects to a canonical `www.tiktok.com/@/video/<id>?...` URL, HTTP 200. Server-side resolution works. Plan §4.1 stands.

---

## 6. What this does to the plan

### The resolve/download split does not survive

The plan assumed `/tiktok/resolve?url=` hands back a media URL and `/download?url=` proxies it, the two calls independent. **They are not independent.** The cookie that authorises the media is minted by the page fetch that happens inside `resolve`. A `download` call arriving later, without that session, gets 403.

Two ways out.

**(a) Stateful.** `resolve` caches the cookie against an opaque token; `download` presents the token. Cost: the Worker now holds per-resolve state, which means Workers KV or Cache API. **This climbs a rung the BUILD PREFLIGHT explicitly refused** - "Data engine: localStorage only. No rung climbed. No database enters."

**(b) Stateless - recommended.** `resolve` fetches the page and returns the preview card plus quality labels and gear names, holding no URL. `download?id=&gear=` re-fetches the page in its own session, picks the matching gear, and streams it in the same invocation. Cost: two upstream page fetches per completed download instead of one. Roughly 400 kB of Worker ingress each, well inside the free tier at Brian's volume.

Option (b) keeps the preflight honest, adds no storage, and keeps the whole thing one deployable file. Take it.

### Step 5 is now a bigger risk, not a smaller one

The route depends on an Akamai edge issuing a session cookie and honouring it. Akamai is precisely the layer most likely to treat Cloudflare Worker egress differently from residential egress, and there are now **two** authenticated hops rather than one. Everything above was proved from a datacentre IP in this container, which is evidence but not the same evidence.

**Step 5 has not been run and must not be assumed.** Until it passes from `wrangler dev`, Stage 2 does not start.

### Sections to rewrite before Stage 2

| Plan section | Status |
|---|---|
| §4.2 Route A | **Delete.** Replaced by §2 above. |
| §4.2 field table | **Delete.** Written from recall; wrong shape. |
| §6.1 allowlist hosts | **Wrong.** Blocks the video. See §4. |
| §6.1 validation steps 1-6, redirects, size cap | **Correct, keep.** |
| §6.4 watermark fallback | **Delete.** `downloadAddr` is empty. |
| §6.1 rejection of page scraping | **Reversed by evidence.** |
| Stage 2 route table | **Rewrite** for the stateless design, §6(b). |
| §3 provider contract | **Unaffected.** Still correct. |
| Stage 1 | **Unaffected.** Still unconditional, still worth doing first. |

---

## 7. Reproducible recipe

```bash
ID=6718335390845095173
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

# one session, cookie jar shared between both hops
curl -s -o page.html -c jar.txt -L -A "$UA" \
  -H 'Accept-Language: en-US,en;q=0.9' \
  "https://www.tiktok.com/@scout2015/video/$ID"

URL=$(python3 -c "
import re,json
h=open('page.html',encoding='utf-8',errors='replace').read()
m=re.search(r'id=\"__UNIVERSAL_DATA_FOR_REHYDRATION__\"[^>]*>(.*?)</script>',h,re.S)
d=json.loads(m.group(1))
print(d['__DEFAULT_SCOPE__']['webapp.video-detail']['itemInfo']['itemStruct']['video']['playAddr'])")

curl -o video.mp4 -b jar.txt -A "$UA" -H "Referer: https://www.tiktok.com/" "$URL"
```

Expected: `200`, `video/mp4`, ~2.95 MB, no watermark.
Drop `-b jar.txt` and it is `403`. That single line is the whole finding.

---

## Change log

**v1.0 - 5 September 2026 · Nairobi**
Stage 0 steps 1-4 executed and step 6 short link executed. Route A (mobile detail endpoint) returns empty 200 on all six variants and is rejected. Page hydration route verified end to end including visual watermark check. Media URL found to be session-cookie bound, which invalidates the plan's resolve/download split. Allowlist correction recorded. Step 5 (Cloudflare Worker egress) not run and still blocking.
