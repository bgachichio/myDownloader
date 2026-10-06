# CLAUDE.md - myDownloader (the builder's contract)

Load order in Claude Chat: `meta-skills`, `brian`, `builder`, `designer`, `developer`. Claude Code inherits the result and decides nothing the packet left open (`builder` §0.1).

- **App slug:** `mydownloader`. Hosting: Firebase project `mydownloader-f6a9e`, custom domain `mydownloader.gachichio.org`. Proxy: Cloudflare Worker `mydownloader-proxy` on the `bgkaranja` account. **No VM footprint.**
- **Five commands:** `npm run dev` · `npm run build` · `npm test` (plus `npm run lint`, `npm run test:e2e`) · `./deploy.sh` · `./rollback.sh`. Uninstall is `DEPLOY.md` §10, not a sixth script.
- **Defaults every build keeps** (`builder` §6): font size in four steps (`ui.fontScale`), Auto/Light/Dark (`ui.theme`), settings in one tap, installable offline PWA, hamburger menu on mobile (`designer` §12.7). Sign-off and Support sheet (§6.1) via `src/config/support.js`. Drawn visuals (§6.2) in `Efforts/myDownloader/brand`. Tally analytics (§6.3). Search gate (§6.4).
- **Colours:** roles in `src/index.css` (`--c-*`), light and dark. No hex in a component. Sizes in `rem`.
- **Hand back to chat, do not decide:** a new dependency, any change to the Worker's allowlist or origin list, a new port or hosting target, a change to what is counted or promised about privacy, any deviation from the colour roles.
- **Gate:** `pre-commit run --all-files`, `npm audit`, `npm run lint`, `npm test`, `npx playwright test` all clean before a push. Never `--no-verify`.
- **Privacy claim to keep true:** the Worker keeps no logs (`[observability] enabled = false`), the pasted link never reaches Tally, history stays in the browser. If the copy changes, the code must match.
