# 10: Test on a real Mac

**One-off.** Initial Mac bring-up, done once — not an ongoing test platform. Ongoing Mac coverage is ticket 11 (CI) plus `diagnose-mac.sh` for user bug reports.

**What to find out** (things macOS CI can't see, because CI can't run Bridge): on Apple Silicon with `PlayerDebugMode` **not** set —

- Install with the ticket-09 one-liner; restart Bridge; open Focus Points.
- Does Bridge on Mac load the self-signed extension (the Mac equivalent of ticket 01)?
- Can the panel spawn `/usr/bin/perl` from inside Bridge (no macOS privacy / Files & Folders prompt blocking it)?
- A Fuji sample RAF: preview renders, AF box in the right place, panel docks.

**How:** a friend with a Mac does one pass — one message, one reply, ~10 minutes. They run the install one-liner, open a sample RAF we send, screenshot the panel, then run `tools/diagnose-mac.sh` and send back its output file. If that works, Mac is done.

**Also build:** `tools/diagnose-mac.sh` — no sudo, read-only. Collects macOS version, chip (`uname -m`), Bridge version, whether `/usr/bin/perl` exists and its version, whether the extension folder is present and passes signature verification if ZXPSignCmd is available, exiftool output on the sample file, `PlayerDebugMode` state, and the tail of the CSXS/CEP logs (`~/Library/Logs/CSXS/`), into one text file on the Desktop.

**Fallback, not needed now — rented Mac.** Only if macOS CI (ticket 11) can't be made to work, or a real Mac user has trouble the diagnostics output doesn't explain: rent an Apple Silicon Mac mini on Scaleway for a day (M2 Pro listed at €0.21/h, 24 h minimum from Apple's licence, then hourly — about €5 plus VAT; delete the instance once done). Install Bridge with a free Adobe ID; Claude drives it over SSH (install, logs, CDP on port 8088 via an SSH tunnel) and Cru checks visually over VNC. Have the fix candidates ready before renting so the day is spent testing. A local macOS VM was considered and rejected: x86 hosts only run Intel macOS (no Apple Silicon coverage), no GPU passthrough for the 4080, licence-grey, and setup is its own project.

**Blocked by:** 08, 09

**Status:** ready-for-human

- [ ] `diagnose-mac.sh` exists and is attached to releases
- [ ] Friend pass: screenshot + diagnostics file recorded here (macOS version, chip, Bridge version, pass/fail per check)
- [ ] Any fix needed becomes its own ticket (and, if diagnostics can't explain it, consider the Scaleway fallback)

## Comments

2026-11-11: `tools/diagnose-mac.sh` written and attached to releases by the workflow (syntax-checked only; it needs a Mac to run). Everything else here needs the friend with a Mac, after the first release exists.
