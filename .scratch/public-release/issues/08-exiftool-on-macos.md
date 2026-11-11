# 08: exiftool on macOS (Perl build, platform pick)

**What to build:** The only hard blocker for Mac. `client/lib/exiftool.js` hardcodes `vendor/exiftool/exiftool.exe`, so on a Mac every image errors out.

- **Bundle the Perl exiftool** (the `exiftool` script + `lib/`) under e.g. `vendor/exiftool-perl/`, at the same version as the Windows build (13.55). A copy exists in `reference/focuspoints.lrplugin/bin/exiftool/`, but check its version; otherwise take it from the official exiftool Unix distribution.
- **Pick by platform** in `exiftool.js`: win32 keeps spawning the `.exe`; darwin spawns `/usr/bin/perl <vendor>/exiftool-perl/exiftool`. The `-stay_open` protocol is identical. About five lines.
- If `/usr/bin/perl` is missing (Apple has warned bundled scripting runtimes may go), show a clear status message in the panel rather than a generic error.
- Add the new folder to `THIRD_PARTY_NOTICES` (ticket 03).

Windows behaviour must not change. Nothing else in the panel is platform-specific: `fsName` gives POSIX paths, and temp files use `os.tmpdir()`.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Running the Perl exiftool with system Node + Perl against the fixtures gives the same JSON tags as the `.exe` (can be checked on Windows with any Perl, e.g. Git Bash's)
- [ ] Windows fixtures look identical in Bridge before and after (Cru confirms after sign-install)
- [ ] Missing-Perl case shows a readable status
