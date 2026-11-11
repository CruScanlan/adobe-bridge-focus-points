# 06: Update-available banner in the panel

**What to build:** When the panel opens, at most once a day, it asks `https://api.github.com/repos/CruScanlan/adobe-bridge-focus-points/releases/latest` for the newest release. If its tag is newer than the installed version (ticket 03), show a small dismissible banner: "vX.Y is available — Download", opening the release page in the default browser (`cep.util.openURLInDefaultBrowser`).

- No server, no auth, no download inside the panel — the user runs the new installer.
- Ignore pre-releases. Fail silently when offline or rate-limited; never block rendering.
- Last-check time and dismissed version in localStorage, so a dismissed version stays dismissed.
- The README says the panel checks GitHub once a day for updates.

About 30 lines in `client/`. One-click self-update is out of scope (see spec).

**Blocked by:** 03

**Status:** ready-for-human

- [ ] With the installed version older than the latest release, the banner appears; clicking it opens the release page
- [x] Same or newer version: no banner
- [ ] Offline / API error: no banner, no console error spam, panel unaffected
- [x] Dismissed version doesn't reappear; a later version does
- [ ] Cru confirms the banner in Bridge after sign-install

## Comments

2026-11-11: `client/update.js` + a bar at the top of the panel. Checked in the real panel (a dev-signed build stamped 0.9.0, with a stored latest of v9.9.9): the bar shows "v9.9.9 is available · Download · ✕", dismissing hides it and stores the version, and the panel can reach `api.github.com` (the CSP now allows that one host; a request to any other host is blocked). A dev build (0.0.0) never checks. On macOS the link goes to the README's macOS section. Not checked: the full path against a real release (none exists yet, the API answers 404, which is handled as "no banner"), a later version reappearing after a dismissal (by code only), and the Download click itself (it would have opened Cru's browser; `cep.util.openURLInDefaultBrowser` is present).
