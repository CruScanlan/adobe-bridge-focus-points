# 04: Windows installer (Inno Setup)

**What to build:** An Inno Setup script (`tools/installer.iss`, ~30 lines) that turns the signed release package into `FocusPointsSetup-vX.Y.Z.exe`:

- Per-user install into `%APPDATA%\Adobe\CEP\extensions\com.cru.bridgefocuspoints` — no admin prompt.
- Installing over an existing version replaces it cleanly (old files removed first, so deleted files don't linger and invalidate the signature).
- Uninstall entry in Windows Settings that removes the folder.
- Warns if Bridge is running (it must be restarted to pick up the change) and finishes with "Restart Bridge, then open Window > Extensions > Focus Points".
- The installer itself is unsigned (see spec).

The installed folder must be byte-identical to the signed `.zxp` contents, or Bridge rejects it.

**Blocked by:** 03

**Status:** ready-for-human

- [ ] Fresh install on the VM: panel loads after a Bridge restart; `ZXPSignCmd -verify` on the installed folder passes
- [ ] Installing a newer version over an older one works and leaves no stray files
- [ ] Uninstall removes the extension; Bridge no longer lists it
- [ ] Cru confirms the install flow in Bridge

## Comments

2026-11-11: `tools/installer.iss` written, **not compiled or run**: Inno Setup is not installed on the VM and Claude did not install it. Per-user into the CEP extensions folder, empties the folder first, uninstaller kept outside the extension folder (in `%LOCALAPPDATA%\BridgeFocusPoints`) so the installed files match the signed package exactly, waits for Bridge to be closed before installing or uninstalling, finish page says to restart Bridge. First real compile will be the release workflow (or `iscc /DAppVersion=0.9.0 tools\installer.iss` after installing Inno Setup 6). All four checkboxes remain open.

2026-11-13: First compile was the release workflow for `v0.9.0-rc1`; it built. Cru ran the installer on the VM: fresh install over the dev build works (installed manifest 0.9.0, no `.debug`, uninstaller in `%LOCALAPPDATA%\BridgeFocusPoints`), panel loads, and the "Bridge is running" prompt works on a reinstall with Bridge open. Not yet tried: upgrade from an older release, uninstall, `ZXPSignCmd -verify` on the installed folder.
