# 01: Sample tests that run outside Bridge

**What to build:** A simple regression system for delegates. Each test sample is one small committed JSON file holding the exiftool tag snapshot for a real camera file plus the points the delegate is expected to produce. One test run (`node --test`, system Node, no Bridge, no raw files needed) feeds every sample's tags to its delegate and compares the result. A snapshot tool takes a raw file and writes the sample file, so adding a camera later is: drop in a raw, run the tool, check the result, commit. The existing Fuji fixtures become the first samples.

Raw files stay gitignored; each sample records where its raw came from (URL or "Cru's own") so it can be re-fetched. A sample may expect face boxes as well as the focus point, and the existing Fuji face data should be covered if any fixture has it.

Keep it small: one samples folder, one test file, one tool. No invariant suites, no generated reports.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One command runs all sample tests with system Node and passes for the existing Fuji fixtures (focus point, portrait orientation, aspect-ratio crop cases)
- [ ] A snapshot tool turns a raw file into a committed sample file (tags + delegate output + source)
- [ ] Tests pass on a checkout with no raw files present
- [ ] Deliberately breaking the Fuji geometry makes a test fail
- [ ] CLAUDE.md documents the add-a-sample workflow in a few lines
