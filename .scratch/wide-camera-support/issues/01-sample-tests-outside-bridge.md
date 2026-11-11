# 01: Sample tests that run outside Bridge

**What to build:** A simple regression system for delegates. Each test sample is one small committed JSON file holding the exiftool tag snapshot for a real camera file plus the points the delegate is expected to produce. One test run (`node --test`, system Node, no Bridge, no raw files needed) feeds every sample's tags to its delegate and compares the result. A snapshot tool takes a raw file and writes the sample file, so adding a camera later is: drop in a raw, run the tool, check the result, commit. The existing Fuji fixtures become the first samples.

Raw files stay gitignored; each sample records where its raw came from (URL or "Cru's own") so it can be re-fetched. A sample may expect face boxes as well as the focus point, and the existing Fuji face data should be covered if any fixture has it.

Keep it small: one samples folder, one test file, one tool. No invariant suites, no generated reports.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] One command runs all sample tests with system Node and passes for the existing Fuji fixtures (focus point, portrait orientation, aspect-ratio crop cases)
- [x] A snapshot tool turns a raw file into a committed sample file (tags + delegate output + source)
- [x] Tests pass on a checkout with no raw files present
- [x] Deliberately breaking the Fuji geometry makes a test fail
- [x] CLAUDE.md documents the add-a-sample workflow in a few lines

## Comments

Done on branch `wide-camera-support`. `node --test` runs `test/samples.test.js` over `test/samples/*.json`; `tools/add-sample.js` snapshots a raw (and writes a check image to look at); `tools/fetch-samples.js` re-downloads raws from each sample's `source`. First samples: the five X-H2 RAFs, the DSCF2659 OOC JPEG and one DJI DNG. DSCF2659 covers portrait orientation and Fuji face/subject boxes; DSCF2561 and DSCF2714 cover the 16:9 aspect crop. Checked that shifting the Fuji focus point by 10 px fails six tests. The tool redacts `InternalSerialNumber`, so no camera serial is committed.
