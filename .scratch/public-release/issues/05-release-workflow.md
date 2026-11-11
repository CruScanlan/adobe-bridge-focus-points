# 05: Automated release workflow

**What to build:** A GitHub Actions workflow (`.github/workflows/release.yml`, Windows runner) triggered by pushing a `v*` tag:

1. Stamp the tag's version into the manifest (ticket 03's single source).
2. Fetch `ZXPSignCmd.exe` (it is gitignored). There is no `clipfix.exe` to build: ticket 02 resolved to ship neither the GPU flags nor the helper.
3. Build the release package: no `.debug`, notices included, signed with the release cert from repo secrets (`RELEASE_CERT_P12` base64 + `RELEASE_CERT_PASS`), timestamped.
4. Build the installer from ticket 04.
5. Create the GitHub Release for the tag with `FocusPointsSetup-vX.Y.Z.exe`, `focuspoints-vX.Y.Z.zxp` and (once ticket 09 lands) `install-mac.sh` attached, and auto-generated notes. Everything builds on the Windows runner — the `.zxp` is cross-platform and the Mac script is plain text, so no macOS runner is needed.

Releasing becomes `git tag vX.Y.Z && git push --tags`. Document that, plus the one-time secret setup, in `docs/releasing.md`.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-human

- [ ] A test tag (e.g. `v0.9.0-rc1`, marked pre-release) produces both artifacts on a GitHub Release with no manual steps
- [ ] The `.exe` from the release installs and loads in Bridge on the VM (Cru confirms)
- [ ] The cert and its password never appear in logs or the repo
- [x] `docs/releasing.md` covers the secret setup and the tag-to-release step

## Comments

2026-11-11: `.github/workflows/release.yml` and `docs/releasing.md` written, **never run** (nothing has been pushed). On a `v*` tag: runs CI, fetches ZXPSignCmd 4.1.103 from Adobe-CEP/CEP-Resources (sha256 pinned; same file as the local one), builds with the cert from secrets, compiles the installer (installs Inno Setup with choco if the runner lacks it), publishes the release with the `.exe`, `.zxp`, `install-mac.sh` and `diagnose-mac.sh`. A tag with a suffix becomes a pre-release. No timestamp, see ticket 03. The cert is written to the runner's temp dir and deleted; the password is only ever an environment variable. Needs the secrets from `docs/releasing.md` before the first tag; then try `v0.9.0-rc1`.
