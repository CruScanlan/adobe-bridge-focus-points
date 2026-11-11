# 04: Nikon Z focus area

**Scope:** the panel exists mainly so landscape photographers can see where each frame of a focus stack was focused. The single primary focus point, in the right place, must work on every target body. Detected faces are wanted too, but best-effort: they need not be perfect on every model.

**What to build:** Selecting a Nikon Z-series NEF in Bridge draws the AF area on the photo, with a Nikon shooting-info line. Ported from the contrast-AF path of the Focus-Points Lr plugin's Nikon delegate (ADR 0001):

- AF area from `AFAreaXPosition` / `AFAreaYPosition` / `AFAreaWidth` / `AFAreaHeight`, which are already pixel coordinates in the native frame.
- In-camera crop modes (DX, 16:9, etc.) handled via the `CropHiSpeed` transform.
- Manual focus and files without these tags show a clear status and no box.

The same path also covers Nikon DSLRs shot in live view, for free.

Faces: the Lr plugin has no Nikon face geometry to port. With subject detection on, the recorded AF area is normally the detected subject's box, so it is drawn anyway. If exiftool exposes separate face positions for these bodies, draw them on the Faces layer; if not, say so in CLAUDE.md.

**Target bodies**, newest first, covering every Z generation:

- Full frame: Z8, Z7 II, Z7; Z6 III, Z6 II, Z6.
- Crop sensor (same geometry, samples only): Z50 II, Z50, Zfc.

The generations before the Z7 are the DSLRs in ticket 06. Fetch one sample per body from raw.pixls.us (CC0) and add it with the ticket 01 tool.

**Blocked by:** 01, 02

**Status:** ready-for-human

- [x] A sample is committed and passes for every target body that has a file on raw.pixls.us; any body without one is listed in CLAUDE.md as untested
- [x] At least one sample is a crop-mode shot, or the crop transform is covered by a sample with hand-edited tags and noted as unverified on real data
- [x] Each sample's box position was checked by eye against the image before its expected output was committed
- [x] A manual-focus or no-AF-data Nikon file shows a status message, not an error
- [x] Faces are drawn if exiftool exposes them, otherwise CLAUDE.md records that they are unavailable. Neither outcome blocks this ticket
- [ ] Cru confirms one NEF renders correctly in Bridge after sign-install
- [x] CLAUDE.md status section lists Nikon Z and the bodies sampled

## Comments

Code done on branch `wide-camera-support`; left for Cru: look at one NEF in Bridge.

- Samples for all nine bodies, checked by eye (Z6 on the toy's eye, Zfc on the flower's centre, Z7 on the colour chart).
- Z8: all three raw.pixls.us files are auto-area AF, which writes `AFPointsUsed` (grid names) and no AF-area tags. That needs a point map, so it is picked up in ticket 06.
- Crop: four real crop-mode samples (Z6 III DX, 16:9 and 1:1; Z50 II 16:9), all centre points. The transform differs from the Lr plugin for 16:9 and 1:1 (see CLAUDE.md for why); off-centre points in those two modes are unverified.
- Faces: exiftool exposes none for Nikon; recorded in CLAUDE.md.
- `FocusDistance` is shown in the Nikon info line. That touches the spec's open question; easy to drop if unwanted.
