#!/usr/bin/env bash
# Stage 0 step 5. The one test that was never run.
#
# Everything in docs/TIKTOK-EXTRACTION.md was proved from a datacentre IP, not
# from Cloudflare. The TikTok route depends on an Akamai edge issuing a session
# cookie and honouring it, and Akamai is exactly the layer most likely to treat
# Worker egress differently. If this fails, nothing in this package ships.
#
# Usage:  ./scripts/verify-egress.sh
# Needs:  wrangler, logged in to the account that owns mydownloader-proxy.

set -euo pipefail
cd "$(dirname "$0")/.."

PORT=8799
PAGE="https://www.tiktok.com/@scout2015/video/6718335390845095173"

cleanup() { [[ -n "${DEV_PID:-}" ]] && kill "$DEV_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "→ starting wrangler dev on :$PORT"
npx wrangler dev --port "$PORT" --local=false >/tmp/wrangler-verify.log 2>&1 &
DEV_PID=$!

for _ in $(seq 1 40); do
  sleep 1
  curl -sf "http://127.0.0.1:$PORT/tiktok/resolve?url=$PAGE" -o /tmp/resolve.json && break
done

if [[ ! -s /tmp/resolve.json ]]; then
  echo "✗ resolve never answered. Worker log:"; tail -20 /tmp/wrangler-verify.log
  exit 1
fi

if grep -q '"error"' /tmp/resolve.json; then
  echo "✗ STEP 5 FAILED at resolve — TikTok refused Cloudflare egress:"
  cat /tmp/resolve.json
  echo
  echo "  Do not deploy. The TikTok route is not viable from a Worker."
  exit 1
fi

GEAR=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/resolve.json')).variants[0].gear)")
echo "→ resolve OK, best gear: $GEAR"

CODE=$(curl -s -o /tmp/verify.mp4 -w '%{http_code}' \
  "http://127.0.0.1:$PORT/tiktok/download?url=$PAGE&gear=$GEAR")
SIZE=$(wc -c < /tmp/verify.mp4)

if [[ "$CODE" != "200" || "$SIZE" -lt 100000 ]]; then
  echo "✗ STEP 5 FAILED at download — HTTP $CODE, $SIZE bytes"
  head -c 300 /tmp/verify.mp4; echo
  echo "  Do not deploy. The cookie handshake does not survive Cloudflare egress."
  exit 1
fi

echo "✓ STEP 5 PASSED — HTTP 200, $SIZE bytes from Cloudflare egress"
echo "  Saved to /tmp/verify.mp4. Play it and confirm there is no watermark."
echo "  You may now deploy."
