# 01: Confirm a self-signed extension loads without PlayerDebugMode

**What to find out:** Whether Bridge 2026 loads our self-signed `.zxp` for a normal user who has never set `HKCU\Software\Adobe\CSXS.12\PlayerDebugMode`. The whole plan assumes yes (CEP verifies the signature's integrity, not a trusted chain), but it has only ever been tested with debug mode on. If it is no, the release plan changes (a paid certificate, or the Marketplace becomes the only route) — so this goes first.

**How:** On the VM, export then delete the `PlayerDebugMode` value, run `bash tools/sign-install.sh`, fully restart Bridge and open Window > Extensions > Focus Points. Restore the value afterwards. Better still, repeat on a machine that has never had debug mode set.

**Blocked by:** —

**Status:** resolved

- [x] Result recorded here: panel renders / "Unable to load" / crash, with the CEP log line from `%TEMP%\CEP12-KBRG.log`
- [ ] If it fails: note the next option to try (timestamped signing, a different cert type) before changing the spec

## Answer

**Yes, on Windows: the panel renders with no `PlayerDebugMode`** (2026-11-11, Bridge 16.0.8, CEP 12.0.1).

It turned out the VM is itself a machine that has never had debug mode set. Read from a normally launched process, `HKCU\Software\Adobe\CSXS.12` holds only `LogLevel=1` and was last written on 2026-05-31, the day Bridge was installed. The `PlayerDebugMode=1` everyone believed was there had been written from a Claude session, and the Claude desktop app is an MSIX package, so the write went to the package's private registry hive and never reached Bridge. Every normal launch since June has therefore been a no-debug-mode launch, and the self-signed extension has loaded throughout — including every normal launch on 2026-11-11.

So the delete-and-retest in "How" was not needed, and the release plan stands as written.

What this does not cover:

- **No CEP log line to quote.** At `LogLevel=1` a successful load writes nothing about the signature to `CEP12-KBRG.log`.
- **One machine, Windows only.** macOS is ticket 10.
- **The dev build, not a release build.** It is signed with `tools/cert.p12`, untimestamped, and ships `.debug` (which opened port 8088 without debug mode too). A release-cert, timestamped build has not been tried.
- **Real debug mode is untested** in either direction, including whether it would let an unsigned extension load.

