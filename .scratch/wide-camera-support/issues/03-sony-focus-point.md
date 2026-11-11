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

**Status:** ready-for-human

- [x] A sample is committed and passes for every target body that has a file on raw.pixls.us; any body without one is listed in CLAUDE.md as untested
- [x] Each sample's box position was checked by eye against the image (box sits on something plausibly in focus) before its expected output was committed
- [x] A manual-focus or no-AF-data Sony file shows a status message, not an error
- [x] Faces are drawn where recorded, and one face sample is committed if raw.pixls.us has one. A missing or imperfect face box does not block this ticket
- [ ] Cru confirms one ARW renders correctly in Bridge after sign-install
- [x] CLAUDE.md status section lists Sony and the bodies sampled

## Comments

Code done on branch `wide-camera-support`; left for Cru: look at one ARW in Bridge.

- Samples for all ten bodies. Eight have an AF point and were checked by eye (e.g. A7R III on the figurine's head, a6400 on the statue's eye, A7R IV on the lone tree). A7R II and A7 II are manual-focus files only, on every raw.pixls.us file tried (three for the A7R II, two for the A7 II), so they are committed as "manual focus" samples and listed in CLAUDE.md as untested for AF.
- Faces: ported, but no sample has `FacesDetected` > 0, so the face box is unverified. The faces checkbox stays open.
- Centring shift: not ported as arithmetic. The panel fits the delegate's frame centred on the preview, which is the same correction. No real non-3:2 Sony file was found to confirm it (the files labelled 4:3 on raw.pixls.us are 3:2).
- Phase-detect fallback is ported; no sample exercises it (none has an all-zero `FocusLocation`). On the a6600 the first phase-detect point lands within a pixel of `FocusLocation`, which supports the scaling.

**2026-11-11, later:** autofocus samples found on Imaging Resource. A7R II: a real AF-S flexible-spot file (shot in 16:9) and a file with a detected face; A7 II: a file with a detected face. Face boxes land on the face in both, so the faces checkbox is now ticked. The delegate now draws faces in manual focus too. Finding: the **A7 II's AF-S file has no `FocusLocation` and no phase-detect points**, so that body has no focus point to draw; it is recorded as "no AF data" as the ticket allows.
