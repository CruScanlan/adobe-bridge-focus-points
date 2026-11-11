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

**Status:** ready-for-human

- [ ] macOS CI job runs the sample tests through Perl exiftool and passes
- [ ] Windows and macOS exiftool JSON for the samples match
- [ ] Install-script smoke test runs in CI
- [ ] Release workflow refuses to publish when either platform fails
- [x] README's bug-report section tells Mac users to attach `diagnose-mac.sh` output

## Comments

2026-11-11: the sample tests this ticket depends on now exist. `node --test` from the repo root runs `test/samples.test.js` over `test/samples/*.json`; it needs only Node (no exiftool, no raw files), so the same command works on the macOS runner as is. Note that this alone does not exercise the Perl exiftool: the samples hold tags already extracted on Windows. The exiftool-parity half of this ticket needs raw files on the runner; `node tools/fetch-samples.js <name-filter>` downloads the ones with a URL source (pick a few small ones, e.g. `canon-r6` at 5 MB), and `tools/add-sample.js` goes through `client/lib/exiftool.js`, so it will use whatever platform pick ticket 08 adds. The check-image step needs ImageMagick and is skipped when it is missing.

2026-11-11: `.github/workflows/ci.yml` written, **never run** (nothing has been pushed). Windows + macOS: `node --test`, then six small raws fetched from raw.pixls.us and `tools/check-exiftool.js` (real exiftool, tags and boxes compared with the committed samples; Perl route on macOS). Both platforms compare against the same snapshots, which is the parity check. macOS also runs the install-script smoke test; an ubuntu job runs shellcheck. `release.yml` calls this workflow and needs it to pass. Expect the first macOS run to need a fix or two (the Perl route was only verified with Git Bash's Perl 5.42, not Apple's 5.30/5.34). The other checkboxes stay open until a run is green.
