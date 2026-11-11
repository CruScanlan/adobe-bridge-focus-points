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

**Status:** ready-for-agent

- [ ] A sample is committed and passes for every target body that has a file on raw.pixls.us; any body without one is listed in CLAUDE.md as untested
- [ ] At least one sample is a crop-mode shot, or the crop transform is covered by a sample with hand-edited tags and noted as unverified on real data
- [ ] Each sample's box position was checked by eye against the image before its expected output was committed
- [ ] A manual-focus or no-AF-data Nikon file shows a status message, not an error
- [ ] Faces are drawn if exiftool exposes them, otherwise CLAUDE.md records that they are unavailable. Neither outcome blocks this ticket
- [ ] Cru confirms one NEF renders correctly in Bridge after sign-install
- [ ] CLAUDE.md status section lists Nikon Z and the bodies sampled
