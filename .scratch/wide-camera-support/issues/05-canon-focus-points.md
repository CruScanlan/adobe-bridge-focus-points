# 05: Canon focus points

**Scope:** the panel exists mainly so landscape photographers can see where each frame of a focus stack was focused. The single primary focus point, in the right place, must work on every target body. Detected faces are wanted too, but best-effort: they need not be perfect on every model.

**What to build:** Selecting a Canon CR3 or CR2 in Bridge draws the AF point(s) that were in focus, with a Canon shooting-info line. Ported from the Focus-Points Lr plugin's Canon delegate (ADR 0001). Canon records its AF areas as lists of positions and sizes relative to an AF image frame, measured from the frame centre with the Y axis pointing up, plus lists of which areas were in focus and which were selected. The port must carry over that coordinate conversion and the Lr plugin's model-specific quirks, for the target bodies only.

- In-focus point(s) drawn as focus boxes.
- Manual focus and files without Canon AF data show a clear status and no box.

Faces: the Lr plugin has no Canon face geometry to port. If exiftool exposes face positions for these bodies, draw them on the Faces layer; if not, say so in CLAUDE.md.

Out of scope until someone asks: selected-but-not-in-focus points.

**Target bodies**, newest first, covering the current generation and at least two back:

- Full frame: R5 Mark II, R5, EOS R, 5D Mark IV, 5D Mark III; R6 Mark II, R6.
- Crop sensor (same geometry, samples only): R7, R10, 90D.
- Added by Cru (2026-11-11): the EOS 80D and bodies like it: 80D, 70D, 77D, 7D Mark II, 6D Mark II.

Fetch one sample per body from raw.pixls.us (CC0) and add it with the ticket 01 tool.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] A sample is committed and passes for every target body that has a file on raw.pixls.us; any body without one is listed in CLAUDE.md as untested
- [ ] Each sample's box position was checked by eye against the image before its expected output was committed
- [ ] A manual-focus or no-AF-data Canon file shows a status message, not an error
- [ ] Faces are drawn if exiftool exposes them, otherwise CLAUDE.md records that they are unavailable. Neither outcome blocks this ticket
- [ ] Cru confirms one CR3 renders correctly in Bridge after sign-install
- [ ] CLAUDE.md status section lists Canon and the bodies sampled
