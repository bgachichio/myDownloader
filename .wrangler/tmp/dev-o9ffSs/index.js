var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/lib/allowlist.js
var EXACT = [
  "video.twimg.com",
  // X - unchanged from v6.3
  "v16-webapp-prime.us.tiktok.com"
  // TikTok video, verified 2026-09-05
];
var SUFFIX = [
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  // audio: v19.tiktokcdn-us.com, verified 2026-09-05
  "tiktokcdn-eu.com",
  "tiktokv.com",
  "tiktokv.us",
  "ttwstatic.com",
  "byteoversea.com",
  "muscdn.com"
];
var PATTERNS = [
  /^v\d{1,3}-webapp-prime(?:\.[a-z]{2,3})?\.tiktok\.com$/
];
var MAX_URL_LENGTH = 2048;
var MAX_BYTES = 300 * 1024 * 1024;
function allowedHost(hostname) {
  const h = String(hostname).toLowerCase();
  if (EXACT.includes(h)) return true;
  if (SUFFIX.some((d) => h === d || h.endsWith("." + d))) return true;
  return PATTERNS.some((p) => p.test(h));
}
__name(allowedHost, "allowedHost");
function validate(raw) {
  if (typeof raw !== "string" || !raw || raw.length > MAX_URL_LENGTH) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port) return null;
  if (!allowedHost(u.hostname)) return null;
  return u;
}
__name(validate, "validate");

// worker/lib/tiktok.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var HYDRATION = /id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/;
function isTikTokUrl(raw = "") {
  return /(?:^|\/\/)(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\//i.test(raw.trim());
}
__name(isTikTokUrl, "isTikTokUrl");
function readSetCookie(headers) {
  const all = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie")].filter(Boolean);
  return all.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}
__name(readSetCookie, "readSetCookie");
async function loadItem(pageUrl) {
  const res = await fetch(pageUrl, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`TikTok page returned ${res.status}`);
  const cookie = readSetCookie(res.headers);
  const html = await res.text();
  const m = HYDRATION.exec(html);
  if (!m) throw new Error("TikTok changed its page shape - no hydration data");
  const scope = JSON.parse(m[1])?.__DEFAULT_SCOPE__ ?? {};
  const detail = scope["webapp.video-detail"];
  if (!detail) throw new Error("No video data on that page");
  if (detail.statusCode !== 0) {
    throw new Error("That post is private, deleted, or region-locked");
  }
  const item = detail.itemInfo?.itemStruct;
  if (!item) throw new Error("No video data on that page");
  return { item, cookie };
}
__name(loadItem, "loadItem");
function firstAllowed(list = []) {
  for (const u of list) {
    if (validate(u)) return u;
  }
  return null;
}
__name(firstAllowed, "firstAllowed");
function variantsOf(item) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const b of item.video?.bitrateInfo ?? []) {
    const url = firstAllowed(b.PlayAddr?.UrlList);
    const gear = b.GearName;
    if (!url || !gear || seen.has(gear)) continue;
    seen.add(gear);
    out.push({
      gear,
      quality: qualityLabel(gear, item.video?.height),
      codec: (b.CodecType ?? "").startsWith("h265") ? "h265" : "h264",
      bitrate: b.Bitrate ?? 0
    });
  }
  out.sort((a, b) => {
    if (a.quality !== b.quality) return b.bitrate - a.bitrate;
    if (a.codec !== b.codec) return a.codec === "h264" ? -1 : 1;
    return b.bitrate - a.bitrate;
  });
  const byLabel = /* @__PURE__ */ new Set();
  const deduped = out.filter((v) => {
    if (byLabel.has(v.quality)) return false;
    byLabel.add(v.quality);
    return true;
  });
  out.length = 0;
  out.push(...deduped);
  if (!out.length) {
    const single = firstAllowed([item.video?.playAddr].filter(Boolean));
    if (single) {
      out.push({
        gear: "default",
        quality: item.video?.height ? `${item.video.height}p` : "Best available",
        codec: (item.video?.codecType ?? "").startsWith("h265") ? "h265" : "h264",
        bitrate: item.video?.bitrate ?? 0
      });
    }
  }
  return out;
}
__name(variantsOf, "variantsOf");
function diagnose(item) {
  const pa = item.video?.playAddr;
  let host = null;
  try {
    host = pa ? new URL(pa).hostname : null;
  } catch {
  }
  return {
    bitrateInfoCount: (item.video?.bitrateInfo ?? []).length,
    hasPlayAddr: Boolean(pa),
    playAddrHost: host,
    playAddrAllowed: pa ? Boolean(validate(pa)) : false,
    hasMusic: Boolean(item.music?.playUrl),
    height: item.video?.height ?? null
  };
}
__name(diagnose, "diagnose");
function qualityLabel(gear, fallbackHeight) {
  const m = /_(\d{3,4})_/.exec(gear);
  const h = m ? Number(m[1]) : fallbackHeight;
  if (!h) return gear;
  return h >= 1080 ? "1080p HD" : `${h}p`;
}
__name(qualityLabel, "qualityLabel");
function mediaUrlFor(item, gear) {
  if (gear === "default") return firstAllowed([item.video?.playAddr].filter(Boolean));
  for (const b of item.video?.bitrateInfo ?? []) {
    if (b.GearName === gear) return firstAllowed(b.PlayAddr?.UrlList);
  }
  return item.video?.playAddr ?? null;
}
__name(mediaUrlFor, "mediaUrlFor");
async function resolve(rawUrl) {
  const { item } = await loadItem(rawUrl);
  const variants = variantsOf(item);
  if (!variants.length) {
    const d = diagnose(item);
    throw new Error(
      `No downloadable video in that post. Payload seen: bitrateInfo=${d.bitrateInfoCount}, playAddr=${d.hasPlayAddr}${d.playAddrHost ? ` (${d.playAddrHost}, allowed=${d.playAddrAllowed})` : ""}.`
    );
  }
  return {
    provider: "tiktok",
    id: item.id,
    pageUrl: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
    variants,
    caption: item.desc ?? "",
    authorName: item.author?.nickname ?? "",
    authorHandle: item.author?.uniqueId ?? "",
    thumbnailUrl: item.video?.cover ?? null,
    durationSeconds: item.video?.duration ?? 0
  };
}
__name(resolve, "resolve");
async function download(pageUrl, gear) {
  const { item, cookie } = await loadItem(pageUrl);
  const media = mediaUrlFor(item, gear);
  if (!media) throw new Error("That quality is no longer available");
  const checked = validate(media);
  if (!checked) throw new Error("Media host is not on the allowlist");
  const upstream = await fetch(checked, {
    headers: {
      "User-Agent": UA,
      Referer: "https://www.tiktok.com/",
      Cookie: cookie
    }
  });
  if (!upstream.ok) {
    throw new Error(`TikTok CDN returned ${upstream.status}`);
  }
  const len = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(len) && len > MAX_BYTES) {
    throw new Error("That file is too large to proxy");
  }
  const handle = item.author?.uniqueId ?? "tiktok";
  const name = `${handle}-${item.id}.mp4`;
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": upstream.headers.get("content-length") ?? "",
      "Cache-Control": "no-store"
    }
  });
}
__name(download, "download");

// worker/lib/x.js
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*"
};
function jsonErr(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}
__name(jsonErr, "jsonErr");
function getSyndicationToken(id) {
  return (Number(id) / 1e15 * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}
__name(getSyndicationToken, "getSyndicationToken");
async function handleTweetLookup(tweetId) {
  if (!/^\d{1,20}$/.test(tweetId)) return jsonErr("Invalid tweet ID", 400);
  const token = getSyndicationToken(tweetId);
  const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;
  let res;
  try {
    res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json"
      }
    });
  } catch (e) {
    return jsonErr(`Network error reaching X: ${e.message}`, 502);
  }
  if (!res.ok) return jsonErr(`X API error: ${res.status}`, res.status);
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...CORS }
  });
}
__name(handleTweetLookup, "handleTweetLookup");
async function handleVideoDownload(request, rawUrl) {
  if (!rawUrl || rawUrl.length > 512) return jsonErr("Invalid URL", 400);
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return jsonErr("Malformed URL", 400);
  }
  if (parsed.hostname !== "video.twimg.com") return jsonErr("URL not allowed", 403);
  if (parsed.protocol !== "https:") return jsonErr("HTTPS only", 400);
  parsed.search = "";
  const cleanUrl = parsed.toString();
  const upstreamHeaders = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: "https://x.com/",
    Origin: "https://x.com",
    Accept: "*/*"
  };
  const rangeHeader = request.headers.get("Range");
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;
  let upstream;
  try {
    upstream = await fetch(cleanUrl, { headers: upstreamHeaders });
  } catch (e) {
    return jsonErr(`Failed to fetch video: ${e.message}`, 502);
  }
  if (!upstream.ok && upstream.status !== 206) {
    return jsonErr(`video.twimg.com returned ${upstream.status}`, upstream.status);
  }
  const responseHeaders = { ...CORS };
  responseHeaders["Content-Type"] = upstream.headers.get("Content-Type") || "video/mp4";
  responseHeaders["Accept-Ranges"] = "bytes";
  const contentLength = upstream.headers.get("Content-Length");
  const contentRange = upstream.headers.get("Content-Range");
  if (contentLength) responseHeaders["Content-Length"] = contentLength;
  if (contentRange) responseHeaders["Content-Range"] = contentRange;
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
__name(handleVideoDownload, "handleVideoDownload");
async function handleX(request, url) {
  const tweetId = url.searchParams.get("id");
  const videoUrl = url.searchParams.get("url");
  const path = url.pathname.replace(/\/+/g, "/");
  if (path === "/download" && videoUrl) {
    return handleVideoDownload(request, videoUrl);
  }
  if (tweetId) {
    return handleTweetLookup(tweetId);
  }
  return jsonErr("Usage: /?id=TWEET_ID  or  /download?url=VIDEO_URL", 400);
}
__name(handleX, "handleX");

// worker/index.js
var CORS2 = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...CORS2 }
}), "json");
function toMessage(err) {
  console.error("[tiktok]", err?.stack || err?.message || err);
  const m = String(err?.message ?? "");
  if (m.includes("private, deleted")) return { msg: m, status: 404 };
  if (m.includes("page shape")) return { msg: "TikTok changed something. This needs a fix.", status: 502 };
  if (m.includes("allowlist")) return { msg: "That media host is not allowed.", status: 400 };
  if (m.includes("too large")) return { msg: "That file is too large to download here.", status: 413 };
  if (m.includes("CDN returned")) return { msg: "TikTok refused the download. Try again.", status: 502 };
  return { msg: "Could not process that link. Try again.", status: 502 };
}
__name(toMessage, "toMessage");
var worker_default = {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS2 });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const url = new URL(request.url);
    if (url.pathname === "/tiktok/resolve") {
      const target = url.searchParams.get("url");
      if (!target || !isTikTokUrl(target)) {
        return json({ error: "Paste a tiktok.com link." }, 400);
      }
      try {
        return json(await resolve(target));
      } catch (err) {
        const { msg, status } = toMessage(err);
        return json({ error: msg }, status);
      }
    }
    if (url.pathname === "/tiktok/download") {
      const target = url.searchParams.get("url");
      const gear = url.searchParams.get("gear");
      if (!target || !isTikTokUrl(target) || !gear) {
        return json({ error: "Missing url or gear." }, 400);
      }
      try {
        const res = await download(target, gear);
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(CORS2)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      } catch (err) {
        const { msg, status } = toMessage(err);
        return json({ error: msg }, status);
      }
    }
    return handleX(request, url);
  }
};

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-WahVG0/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-WahVG0/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
