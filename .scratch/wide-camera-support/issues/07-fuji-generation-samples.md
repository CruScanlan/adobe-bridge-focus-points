# 07: Fuji samples across generations

**Scope:** the panel exists mainly so landscape photographers can see where each frame of a focus stack was focused. The single primary focus point, in the right place, must work on every target body. Detected faces are wanted too, but best-effort: they need not be perfect on every model.

**What to build:** Confirm the existing Fuji delegate works beyond the X-H2 it was built on. Fetch one sample per body from raw.pixls.us (CC0), add each with the ticket 01 tool, and fix whatever the delegate gets wrong.

**Target bodies**, newest first, covering the current generation and at least two back:

- Crop sensor: X-T5, X-T4, X-T3.
- Medium format: GFX 100S II, GFX 100S, GFX 50S II or 50R.

Faces are already ported for Fuji; if any sample contains face data, check the boxes by eye too.

**Blocked by:** 01

**Status:** resolved

- [x] A sample is committed and passes for every target body that has a file on raw.pixls.us; any body without one is listed in CLAUDE.md as untested
- [x] Each sample's box position was checked by eye against the image before its expected output was committed
- [x] Any body-specific difference found (frame size, missing tags, medium-format aspect) is handled in the delegate and noted in CLAUDE.md

## Comments

Done on branch `wide-camera-support`.

- Samples for X-T5, X-T4, X-T3, GFX 100S II, GFX 100S, GFX 50S II and GFX 50R; both the 50S II and the 50R had files, so both are in. All checked by eye except the X-T3, whose two raw.pixls.us files are both manual focus.
- No geometry fix was needed. GFX files report a 4000x3000 `ExifImage` frame and a matching 4:3 preview, which the frame handling from ticket 02 covers.
- One behaviour change: manual-focus Fuji files (`FocusMode2` = AF-M) used to draw a box at the parked focus frame; they now show "manual focus" and no box, as every other make does. Say if you would rather keep the box for MF.
- Cru's own files are filed as X-H2: the samples were renamed `fuji-x-h2-dscf*.json` (and the DJI one `dji-air-2s-0685.json`); `add-sample.js` gained `--name` for this.
- No downloaded sample has face data.

**2026-11-11, later:** two real autofocus X-T3 files found on Imaging Resource (`fuji-x-t3-af`, `fuji-x-t3-af2` portrait), checked by eye. The X-T3 is no longer untested.
