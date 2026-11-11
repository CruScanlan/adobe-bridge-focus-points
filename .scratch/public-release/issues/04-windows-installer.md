# 04: Windows installer (Inno Setup)

**What to build:** An Inno Setup script (`tools/installer.iss`, ~30 lines) that turns the signed release package into `FocusPointsSetup-vX.Y.Z.exe`:

- Per-user install into `%APPDATA%\Adobe\CEP\extensions\com.cru.bridgefocuspoints` — no admin prompt.
- Installing over an existing version replaces it cleanly (old files removed first, so deleted files don't linger and invalidate the signature).
- Uninstall entry in Windows Settings that removes the folder.
- Warns if Bridge is running (it must be restarted to pick up the change) and finishes with "Restart Bridge, then open Window > Extensions > Focus Points".
- The installer itself is unsigned (see spec).

The installed folder must be byte-identical to the signed `.zxp` contents, or Bridge rejects it.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Fresh install on the VM: panel loads after a Bridge restart; `ZXPSignCmd -verify` on the installed folder passes
- [ ] Installing a newer version over an older one works and leaves no stray files
- [ ] Uninstall removes the extension; Bridge no longer lists it
- [ ] Cru confirms the install flow in Bridge
