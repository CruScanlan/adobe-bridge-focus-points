# 06: Nikon DSLR AF points (D850 / D810 / D800 / D500 / D7500)

**Scope:** the panel exists mainly so landscape photographers can see where each frame of a focus stack was focused. The single primary focus point, in the right place, must work on every target body.

**What to build:** Selecting a viewfinder-shot NEF from a Nikon DSLR draws the primary AF point. DSLRs record point *names* (e.g. `C6`, `E9`), not coordinates, so this needs the per-model point maps from the Focus-Points Lr plugin shipped as data, plus the plugin's phase-detect logic (ADR 0001):

- The primary point from `PrimaryAFPoint`; fall back to `AFPointsUsed` when no primary is recorded.
- The D850 generation (AF info version 0101: D850, D500, D7500) picks its point tag by AF-area mode, as the Lr plugin does.
- In-camera crop offset via `CropHiSpeed`.
- A model with no map shows "this Nikon model is not supported yet", not an error.

Live-view shots from these bodies are already handled by ticket 04's path. Viewfinder AF records no faces, so there is nothing to draw on the Faces layer here.

Out of scope until someone asks: the grey inactive-point grid, and maps for any other DSLR (each is one data file plus a sample).

**Target bodies:**

- Full frame, the generations before the Z7: D850, D810, D800 / D800E (the last three share one map).
- Crop sensor: D500, D7500 (one map each).

Fetch one sample per body from raw.pixls.us (CC0), or rawsamples.ch for the older bodies, and add it with the ticket 01 tool.

**Blocked by:** 01, 02, 04

**Status:** ready-for-agent

- [ ] D850, D810, D800, D500 and D7500 samples are committed and pass; any body with no file on either source is listed in CLAUDE.md as untested
- [ ] Every point name appearing in the samples resolves in its map
- [ ] A DSLR with no shipped map shows the not-supported status
- [ ] Each sample's point position was checked by eye against the image before its expected output was committed
- [ ] Cru confirms one DSLR NEF renders correctly in Bridge after sign-install
- [ ] CLAUDE.md notes how to add another DSLR (map file + sample)
