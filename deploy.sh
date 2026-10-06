#!/usr/bin/env bash
# myDownloader: ship the Worker, then the PWA, check both, roll back the PWA if the check fails.
# Runs on the Lenovo, never on the VM (there is no VM tenant). See DEPLOY.md.
set -euo pipefail
cd "$(dirname "$0")"

SITE=mydownloader-f6a9e
LIVE=https://mydownloader.gachichio.org
WORKER=https://mydownloader-proxy.bgkaranja.workers.dev

echo "== gate"
npm ci
npm run lint
npm test
npm audit --audit-level=high
npm run build
npx playwright test

echo "== keep the current live site as the rollback copy"
firebase hosting:clone "$SITE:live" "$SITE:previous" >/dev/null

echo "== worker"
npx wrangler deploy

echo "== pwa"
firebase deploy --only hosting

echo "== verify"
fail=0
check() { # name, command that must succeed
  if eval "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi
}
check "PWA serves the new page" "curl -fsS $LIVE/ | grep -q 'saves videos from X and TikTok'"
check "manifest and icons" "curl -fsS -o /dev/null $LIVE/manifest.webmanifest && curl -fsS -o /dev/null $LIVE/icons/icon-512x512.png"
check "robots and sitemap" "curl -fsS -o /dev/null $LIVE/robots.txt && curl -fsS -o /dev/null $LIVE/sitemap.xml"
check "CSP header present" "curl -fsSI $LIVE/ | grep -qi '^content-security-policy:'"
check "worker answers the app origin" "curl -fsS -H 'Origin: $LIVE' $WORKER/?id=20 | grep -q Tweet"
check "worker refuses another origin" "test \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Origin: https://evil.example' $WORKER/?id=20)\" = 403"

if [ "$fail" -ne 0 ]; then
  echo "verification failed: rolling the PWA back"
  ./rollback.sh
  exit 1
fi
echo "deployed and verified"
