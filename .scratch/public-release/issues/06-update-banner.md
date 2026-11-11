# 06: Update-available banner in the panel

**What to build:** When the panel opens, at most once a day, it asks `https://api.github.com/repos/CruScanlan/adobe-bridge-focus-points/releases/latest` for the newest release. If its tag is newer than the installed version (ticket 03), show a small dismissible banner: "vX.Y is available — Download", opening the release page in the default browser (`cep.util.openURLInDefaultBrowser`).

- No server, no auth, no download inside the panel — the user runs the new installer.
- Ignore pre-releases. Fail silently when offline or rate-limited; never block rendering.
- Last-check time and dismissed version in localStorage, so a dismissed version stays dismissed.
- The README says the panel checks GitHub once a day for updates.

About 30 lines in `client/`. One-click self-update is out of scope (see spec).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] With the installed version older than the latest release, the banner appears; clicking it opens the release page
- [ ] Same or newer version: no banner
- [ ] Offline / API error: no banner, no console error spam, panel unaffected
- [ ] Dismissed version doesn't reappear; a later version does
- [ ] Cru confirms the banner in Bridge after sign-install
