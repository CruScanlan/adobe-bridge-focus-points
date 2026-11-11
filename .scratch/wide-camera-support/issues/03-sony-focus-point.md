# 03: Sony focus point

**Scope:** the panel exists mainly so landscape photographers can see where each frame of a focus stack was focused. The single primary focus point, in the right place, must work on every target body. Detected faces are wanted too, but best-effort: they need not be perfect on every model.

**What to build:** Selecting a Sony ARW in Bridge draws the focus frame on the photo, with a Sony shooting-info line. Ported from the Focus-Points Lr plugin's Sony delegate (ADR 0001):

- Focus position from `FocusLocation` (frame size + x/y in full-image pixels), box sized from `FocusFrameSize` when present, default size otherwise.
- Centring shift for shots taken in a non-native aspect ratio.
- Fallback to the focal-plane phase-detect point when `FocusLocation` is all zeros.
- Detected faces (`FaceNPosition`) drawn on the Faces layer, best-effort.
- Manual focus and files without Sony AF data show a clear status and no box.

Out of scope until someone asks: the extra (inactive) phase-detect points.

**Target bodies**, newest first, covering the current generation and at least two back:

- Full frame: A7R V, A7R IV, A7R III, A7R II; A7 IV, A7 III, A7 II.
- Crop sensor (same geometry, samples only): a6700, a6600, a6400.

The oldest bodies may not record a focus location at all; if so, record that as "no AF data" rather than chasing it. Fetch one sample per body from raw.pixls.us (CC0) and add it with the ticket 01 tool.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] A sample is committed and passes for every target body that has a file on raw.pixls.us; any body without one is listed in CLAUDE.md as untested
- [ ] Each sample's box position was checked by eye against the image (box sits on something plausibly in focus) before its expected output was committed
- [ ] A manual-focus or no-AF-data Sony file shows a status message, not an error
- [ ] Faces are drawn where recorded, and one face sample is committed if raw.pixls.us has one. A missing or imperfect face box does not block this ticket
- [ ] Cru confirms one ARW renders correctly in Bridge after sign-install
- [ ] CLAUDE.md status section lists Sony and the bodies sampled
