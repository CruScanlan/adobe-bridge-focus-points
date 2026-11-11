# 08: OM System / Olympus focus point

**Scope:** the panel exists mainly so landscape photographers can see where each frame of a focus stack was focused. The single primary focus point, in the right place, must work on every target body. Detected faces are wanted too, but best-effort: they need not be perfect on every model.

**What to build:** Selecting an ORF from an OM System or Olympus body in Bridge draws the focus point on the photo, with a shooting-info line. Ported from the Focus-Points Lr plugin's Olympus delegate (ADR 0001), which is its largest: port only the path that yields the primary focus area for the target bodies (the AF focus area relative to the AF frame size on newer bodies, the selected AF point on older ones), not the full feature set.

- Manual focus and files without AF data show a clear status and no box.
- Subject-detect frames, when recorded, go on the Faces layer, best-effort.
- These bodies are popular for in-camera focus stacking and bracketing; if the delegate exposes focus distance cheaply, include it in the shooting-info line.

Target bodies, newest first: OM-1 Mark II, OM-1, E-M1 Mark III, E-M1 Mark II; OM-5, E-M5 Mark III. Samples from raw.pixls.us (CC0), added with the ticket 01 tool.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] A sample is committed and passes for every target body that has a file on raw.pixls.us; any body without one is listed in CLAUDE.md as untested
- [ ] Each sample's box position was checked by eye against the image before its expected output was committed
- [ ] A manual-focus or no-AF-data file shows a status message, not an error
- [ ] Cru confirms one ORF renders correctly in Bridge after sign-install
- [ ] CLAUDE.md status section lists OM System / Olympus and the bodies sampled
