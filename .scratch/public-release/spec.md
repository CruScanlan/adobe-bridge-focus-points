# Public release

## Why

The plugin works for Cru, but installing it means running a dev script, a self-signed dev certificate and a registry tweak. Other photographers should be able to install it in one step and be told when an update is out, without Cru maintaining a complicated release system — there is little time to spend on this.

## Requirements

- **Install:** download one file, double-click, restart Bridge. No admin rights, no registry edits, no third-party installer app.
- **Update:** the panel tells users when a newer version exists and links to it. Installing the new version over the old one is the upgrade.
- **Releasing is one command:** `git tag vX.Y.Z && git push --tags`. Everything else is automated.
- **Windows and macOS** (Intel and Apple Silicon). One `.zxp` serves both; only the installer differs.
- **No spending.** Every required piece is free: GitHub Releases and Actions (free on a public repo, macOS runners included), Inno Setup, ZXPSignCmd, a self-signed cert, the Marketplace listing. Paid options (Windows code-signing cert, Apple Developer Program, a rented Mac) are deliberately left out and only reconsidered if a real problem can't be solved for free.
- **Low maintenance beats polish.** Skip anything that needs ongoing care (self-updating panel, paid code-signing for the installer) until users ask for it.

## Approach

- **GitHub Releases** are the distribution channel. Each release carries `FocusPointsSetup.exe` (main path) and the raw `.zxp` (for people who use a ZXP installer app).
- **GitHub Actions** builds, signs (with a release cert held in repo secrets, timestamped) and attaches both on every version tag.
- **Inno Setup** per-user installer into `%APPDATA%\Adobe\CEP\extensions\com.cru.bridgefocuspoints`, with an uninstall entry. Unsigned; the README explains the one-time SmartScreen "More info → Run anyway".
- **Update banner** in the panel: at most once a day, ask GitHub's public releases API for the latest tag; if newer than the installed version, show "vX.Y is available — Download" opening the release page.
- **One cross-platform package.** The `.zxp` carries both exiftool builds: the Windows `exiftool.exe` and the platform-independent Perl `exiftool` (script + `lib/`), which macOS runs on its system `/usr/bin/perl`. `client/lib/exiftool.js` picks by `process.platform`. No Mac native binary ships, so there is no arm64/x64 split and nothing for Gatekeeper to notarize. `clipfix` already no-ops off Windows. (Findings from the "Apple Silicon plugin compatibility" session.)
- **Mac install is a Terminal one-liner**, not a `.pkg`: `curl -fsSL <release>/install-mac.sh | bash` downloads the `.zxp` and unzips it into `~/Library/Application Support/Adobe/CEP/extensions/`. Files fetched by `curl` are not quarantined, so it sidesteps Gatekeeper entirely. An unsigned, un-notarized `.pkg` is blocked by recent macOS until the user digs into System Settings → Privacy & Security → "Open Anyway", and fixing that properly needs the paid Apple Developer Program ($99/yr) plus notarizing every release — exactly the upkeep we're avoiding. Revisit a `.pkg` if Mac users find the one-liner too technical; the Marketplace (07) is the other answer to that.
- **Mac testing:** a free GitHub-hosted macOS CI job runs the exiftool + delegate path on every push (ticket 11). CI can't run Bridge, so Bridge loading the panel on Mac is checked once by a friend with a Mac in a single pass (ticket 10), then left to user reports with a one-file diagnostics script. Renting a Scaleway Mac (~€5/day) is a fallback only if CI can't be made to work or a real user's problem can't be explained from diagnostics — not planned, never per release.
- **Creative Cloud Marketplace** is a later, optional second channel using the same `.zxp`. Not a dependency: it is unclear whether Adobe's Developer Distribution portal currently accepts CEP/ZXP listings for Bridge, review slows frequent releases, and CEP listings may be deprecated.

Considered and rejected for now: ZXP-installer-only distribution (users need a second app; aescripts ZXP Installer is unmaintained), manual zip + copy (error-prone), one-click self-update inside the panel (running `clipfix.exe` is file-locked, so swapping files is fiddly to maintain).

## Tickets, in priority order

| # | Ticket | Blocked by |
|---|---|---|
| 01 | Confirm a self-signed extension loads without PlayerDebugMode | — |
| 02 | Decide the GPU flags and clipfix for the public build | — |
| 03 | Release hygiene: licenses, release cert, no `.debug`, version | — |
| 04 | Windows installer (Inno Setup) | 03 |
| 05 | Automated release workflow | 01, 02, 03, 04 |
| 06 | Update-available banner in the panel | 03 |
| 07 | Try a Creative Cloud Marketplace listing | 05 |
| 08 | exiftool on macOS (Perl build, platform pick) | — |
| 09 | Mac install script | 03, 08 |
| 10 | Test on a real Mac (one-off friend check; rented Scaleway Mac only as a fallback) | 08, 09 |
| 11 | Ongoing Mac coverage without a Mac (macOS CI job + diagnostics) | 08, 09, wide-camera-support 01 |

Mac tickets slot in alongside: 08 can start any time; 05 attaches the Mac script once 09 exists.
