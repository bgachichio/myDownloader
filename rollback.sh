#!/usr/bin/env bash
# Put the PWA back to the copy deploy.sh kept before the last release (about 20 seconds).
# The Worker is rolled back separately: npx wrangler deployments list, then npx wrangler rollback <version-id>.
set -euo pipefail
cd "$(dirname "$0")"
SITE=mydownloader-f6a9e
firebase hosting:clone "$SITE:previous" "$SITE:live"
echo "PWA rolled back to the previous release. Installed copies pick it up on next launch (service worker, autoUpdate)."
