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

Also make `tools/sign-install.sh` work on macOS for dev installs: Adobe's macOS ZXPSignCmd, skip the clipfix build, install to the path above, and note `defaults write com.adobe.CSXS.12 PlayerDebugMode 1` in place of the registry step.

**Blocked by:** 03, 08

**Status:** ready-for-agent

- [ ] Script installs, reinstalls over an existing copy, and uninstalls cleanly (shellcheck clean)
- [ ] Update banner on macOS links to the Mac install instructions, not the `.exe`
- [ ] README has the Mac one-liner
- [ ] Verified in Bridge on a real Mac (ticket 10)
