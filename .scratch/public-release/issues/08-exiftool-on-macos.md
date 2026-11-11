# 08: exiftool on macOS (Perl build, platform pick)

**What to build:** The only hard blocker for Mac. `client/lib/exiftool.js` hardcodes `vendor/exiftool/exiftool.exe`, so on a Mac every image errors out.

- **Bundle the Perl exiftool** (the `exiftool` script + `lib/`) under e.g. `vendor/exiftool-perl/`, at the same version as the Windows build (13.55). A copy exists in `reference/focuspoints.lrplugin/bin/exiftool/`, but check its version; otherwise take it from the official exiftool Unix distribution.
- **Pick by platform** in `exiftool.js`: win32 keeps spawning the `.exe`; darwin spawns `/usr/bin/perl <vendor>/exiftool-perl/exiftool`. The `-stay_open` protocol is identical. About five lines.
- If `/usr/bin/perl` is missing (Apple has warned bundled scripting runtimes may go), show a clear status message in the panel rather than a generic error.
- Add the new folder to `THIRD_PARTY_NOTICES` (ticket 03).

Windows behaviour must not change. Nothing else in the panel is platform-specific: `fsName` gives POSIX paths, and temp files use `os.tmpdir()`.

**Blocked by:** —

**Status:** ready-for-human

- [x] Running the Perl exiftool with system Node + Perl against the fixtures gives the same JSON tags as the `.exe` (can be checked on Windows with any Perl, e.g. Git Bash's)
- [ ] Windows fixtures look identical in Bridge before and after (Cru confirms after sign-install)
- [x] Missing-Perl case shows a readable status

## Comments

2026-11-11: done, with one deviation. **No second exiftool copy is bundled.** The Windows bundle already contains the complete pure-Perl ExifTool (`vendor/exiftool/exiftool_files/exiftool.pl` + `lib/Image/ExifTool`, 13.55) next to its Windows-only Perl runtime. `client/lib/exiftool-unix.pl` appends that `lib` to the end of `@INC` (so the system Perl keeps its own core modules) and runs the script. `exiftool.js` spawns `/usr/bin/perl exiftool-unix.pl` on anything that is not Windows; `BFP_PERL=<perl>` forces that route on Windows. Saves 20 MB and keeps both platforms on the same ExifTool by construction.

Checked with `tools/check-exiftool.js` (new: real exiftool over every sample raw on disk, tags + boxes + preview compared with the snapshot): 89/89 through the `.exe`, 89/89 through Git Bash's Perl 5.42. A missing Perl shows "Perl was not found at … install Perl and restart Bridge" as the panel status. Not checked: macOS's own Perl (5.30/5.34) — that is the CI job in ticket 11 — and the Windows panel in Bridge after this change (the Windows spawn line is unchanged).
