// X (Twitter) provider. Recovered from the live Worker on the bgkaranja
// Cloudflare account (never previously in git — see DEPLOY.md section 1) and
// reshaped from a standalone default export into the handleX(request, url)
// signature worker/index.js already expects. No other logic changed.
//
// One bug fixed on recovery: handleTweetLookup called `jsonerr` (lowercase)
// on its validation-failure branch, a name that does not exist anywhere in
// this file - `jsonErr` does. Any malformed tweet ID hit this branch and threw
// an uncaught ReferenceError, which Cloudflare returns as a bare 500 with no
// CORS headers, so the browser's fetch fails as a network error rather than
// showing the person "invalid tweet ID". Confirmed by reading the deployed
// bundle line-for-line; not something that showed up in the app's own error
// handling, because the app never got a response shaped enough to explain.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
};

function jsonErr(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function getSyndicationToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

async function handleTweetLookup(tweetId) {
  if (!/^\d{1,20}$/.test(tweetId)) return jsonErr('Invalid tweet ID', 400);

  const token = getSyndicationToken(tweetId);
  const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;

  let res;
  try {
    res = await fetch(apiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
  } catch (e) {
    return jsonErr(`Network error reaching X: ${e.message}`, 502);
  }
  if (!res.ok) return jsonErr(`X API error: ${res.status}`, res.status);

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function handleVideoDownload(request, rawUrl) {
  if (!rawUrl || rawUrl.length > 512) return jsonErr('Invalid URL', 400);

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return jsonErr('Malformed URL', 400);
  }
  if (parsed.hostname !== 'video.twimg.com') return jsonErr('URL not allowed', 403);
  if (parsed.protocol !== 'https:') return jsonErr('HTTPS only', 400);

  // video.twimg.com 403s with a stale ?tag= still attached.
  parsed.search = '';
  const cleanUrl = parsed.toString();

  const upstreamHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://x.com/',
    Origin: 'https://x.com',
    Accept: '*/*',
  };
  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

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
  responseHeaders['Content-Type'] = upstream.headers.get('Content-Type') || 'video/mp4';
  responseHeaders['Accept-Ranges'] = 'bytes';
  const contentLength = upstream.headers.get('Content-Length');
  const contentRange = upstream.headers.get('Content-Range');
  if (contentLength) responseHeaders['Content-Length'] = contentLength;
  if (contentRange) responseHeaders['Content-Range'] = contentRange;

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export async function handleX(request, url) {
  const tweetId = url.searchParams.get('id');
  const videoUrl = url.searchParams.get('url');
  const path = url.pathname.replace(/\/+/g, '/');

  if (path === '/download' && videoUrl) {
    return handleVideoDownload(request, videoUrl);
  }
  if (tweetId) {
    return handleTweetLookup(tweetId);
  }
  return jsonErr('Usage: /?id=TWEET_ID  or  /download?url=VIDEO_URL', 400);
}
