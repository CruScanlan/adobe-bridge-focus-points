# 01: Confirm a self-signed extension loads without PlayerDebugMode

**What to find out:** Whether Bridge 2026 loads our self-signed `.zxp` for a normal user who has never set `HKCU\Software\Adobe\CSXS.12\PlayerDebugMode`. The whole plan assumes yes (CEP verifies the signature's integrity, not a trusted chain), but it has only ever been tested with debug mode on. If it is no, the release plan changes (a paid certificate, or the Marketplace becomes the only route) — so this goes first.

**How:** On the VM, export then delete the `PlayerDebugMode` value, run `bash tools/sign-install.sh`, fully restart Bridge and open Window > Extensions > Focus Points. Restore the value afterwards. Better still, repeat on a machine that has never had debug mode set.

**Blocked by:** —

**Status:** ready-for-human

- [ ] Result recorded here: panel renders / "Unable to load" / crash, with the CEP log line from `%TEMP%\CEP12-KBRG.log`
- [ ] If it fails: note the next option to try (timestamped signing, a different cert type) before changing the spec
