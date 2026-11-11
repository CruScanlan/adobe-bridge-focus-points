# 07: Fuji samples across generations

**Scope:** the panel exists mainly so landscape photographers can see where each frame of a focus stack was focused. The single primary focus point, in the right place, must work on every target body. Detected faces are wanted too, but best-effort: they need not be perfect on every model.

**What to build:** Confirm the existing Fuji delegate works beyond the X-H2 it was built on. Fetch one sample per body from raw.pixls.us (CC0), add each with the ticket 01 tool, and fix whatever the delegate gets wrong.

**Target bodies**, newest first, covering the current generation and at least two back:

- Crop sensor: X-T5, X-T4, X-T3.
- Medium format: GFX 100S II, GFX 100S, GFX 50S II or 50R.

Faces are already ported for Fuji; if any sample contains face data, check the boxes by eye too.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A sample is committed and passes for every target body that has a file on raw.pixls.us; any body without one is listed in CLAUDE.md as untested
- [ ] Each sample's box position was checked by eye against the image before its expected output was committed
- [ ] Any body-specific difference found (frame size, missing tags, medium-format aspect) is handled in the delegate and noted in CLAUDE.md
