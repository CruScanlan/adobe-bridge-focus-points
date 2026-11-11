# 09: Mac install script

**What to build:** `tools/install-mac.sh`, attached to each release (ticket 05). Users run:

```
curl -fsSL https://github.com/CruScanlan/adobe-bridge-focus-points/releases/latest/download/install-mac.sh | bash
```

The script:

- Downloads the latest `.zxp` from GitHub Releases with `curl` (no quarantine flag, so no Gatekeeper prompt).
- Removes any existing `~/Library/Application Support/Adobe/CEP/extensions/com.cru.bridgefocuspoints` and unzips the `.zxp` there (files must match the signature exactly).
- Warns if Bridge is running, and ends with "Restart Bridge, then open Window > Extensions > Focus Points".
- Supports `--uninstall`.
- Plain POSIX shell, no sudo, no Homebrew.

Running it again is the upgrade, which is what the update banner (ticket 06) should point Mac users to. The README gets a Mac section with the one-liner.

Also make `tools/sign-install.sh` work on macOS for dev installs: Adobe's macOS ZXPSignCmd and install to the path above. Windows needs no registry step (ticket 01), so there is nothing to mirror; whether macOS needs `defaults write com.adobe.CSXS.12 PlayerDebugMode 1` is ticket 10's question.

**Blocked by:** 03, 08

**Status:** ready-for-human

- [ ] Script installs, reinstalls over an existing copy, and uninstalls cleanly (shellcheck clean)
- [x] Update banner on macOS links to the Mac install instructions, not the `.exe`
- [x] README has the Mac one-liner
- [ ] Verified in Bridge on a real Mac (ticket 10)

## Comments

2026-11-11: `tools/install-mac.sh` written (POSIX sh). It finds the `.zxp` through the releases API, because `releases/latest/download/` needs a fixed file name and the package name carries the version. Run on Windows under Git Bash with a temp `HOME` and a locally built package: install gives a folder identical to the package (signature verifies), reinstall removes stray files, `--uninstall` removes it. The same checks run on the macOS CI job. shellcheck is not installed here; it runs in CI. **Not done: `sign-install.sh` on macOS.** Adobe's ZXPSignCmd 4.1.103 ships Windows builds only, and nobody on the project has a Mac to develop on; a Mac user installs the release package.
