# 11: Ongoing Mac coverage without a Mac

**Why:** After the one-off bring-up (ticket 10), nobody on the project has a Mac and renting one per release is out. Mac regressions have to be caught automatically or reported by users.

**What to build:**

- **macOS job in CI.** On every push and every release tag, a GitHub Actions `macos-latest` (Apple Silicon) job runs the sample tests (`.scratch/wide-camera-support` ticket 01) with the **bundled Perl exiftool on the system Perl** — the same code path the panel uses on a Mac. This covers what actually differs on Mac: exiftool invocation, POSIX paths, temp files, and tag output parity with the Windows `.exe` (run the same samples on the Windows job and diff the JSON).
- **Install-script smoke test** in the same job: run `install-mac.sh` against the just-built `.zxp` into a temp `HOME`, check the folder matches the `.zxp`, run `--uninstall`.
- **Release gate.** The release workflow (ticket 05) only publishes if both the Windows and macOS jobs pass.

What CI can't cover is Bridge itself loading the panel on a Mac. That layer is verified once in ticket 10 and is unlikely to regress from our changes. Bridge updates breaking it are caught by user reports, triaged with `diagnose-mac.sh` output.

**Keep Mac-specific code tiny** (the exiftool path pick, the install script) so Windows testing in Bridge keeps covering nearly everything.

macOS runner minutes are free on public repos; on a private repo they count at 10× against the free allowance, so check the repo's visibility first.

**Blocked by:** 08, 09, and `.scratch/wide-camera-support` ticket 01

**Status:** ready-for-agent

- [ ] macOS CI job runs the sample tests through Perl exiftool and passes
- [ ] Windows and macOS exiftool JSON for the samples match
- [ ] Install-script smoke test runs in CI
- [ ] Release workflow refuses to publish when either platform fails
- [ ] README's bug-report section tells Mac users to attach `diagnose-mac.sh` output
