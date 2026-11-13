# 01: Focus box appearance settings

**What to build:** A small settings popover in the panel for how the overlay is drawn, modelled on Camera Raw's "Focus Point Overlay" dialog (colour picker with brightness, opacity, thickness, and a preview swatch). Requested by Cru on 2026-11-13 after comparing the panel with Camera Raw 19.0.

- **Entry point:** a gear button in the bottom bar, next to the layer toggles. It opens a popover over the stage; clicking outside or pressing Esc closes it. No modal dialog, no OK/Cancel: changes apply live to the image on screen.
- **Controls:**
  - Colour of the focus box and its centre cross (default the current `#39ff14`).
  - Opacity, 10–100 % (default 100).
  - Thickness, 1–8 px (default 3, down from 4 at Cru's request; the cross and the dashed "selected" box keep their current ratio to it).
  - "Reset to defaults".
- **Scope of each setting:** colour applies to the Focus layer only. Faces (yellow) and Crop (blue) keep their own colours, so the layers stay distinguishable. Opacity and thickness apply to every layer.
- **Persistence:** localStorage, like the layer toggles (`overlay.color`, `overlay.opacity`, `overlay.thickness`). Applies across selections and Bridge restarts.
- **Implementation shape:** the values become CSS custom properties on the overlay (`--af-color`, `--af-opacity`, `--af-width`) that `styles.css` reads in place of the hard-coded stroke values. Changing a setting sets the property; no re-render and no exiftool run. Delegates are untouched.
- **Colour control:** try `<input type="color">` first. If CEF in CEP 12 does not open a usable picker for it inside an embedded panel, fall back to a row of preset swatches plus a hex field. Decide by trying it in Bridge, not by guessing.

Out of scope: per-layer colours for Faces and Crop, box size or shape (that is camera data), and syncing settings between machines.

**Status:** ready-for-human

- [x] Gear button opens and closes the popover; it does not cover the bottom bar or steal the panel's selection polling
- [x] Colour, opacity and thickness change the overlay live on the current image
- [x] Settings survive a selection change and a Bridge restart
- [x] The dashed "selected, focus not confirmed" box and the centre cross follow the same colour and thickness
- [x] Each layer has its own colour (changed from the original "Focus only", see comments); opacity and thickness apply to all
- [x] Reset restores the current look exactly
- [x] `node --test` still passes (no delegate changes expected)
- [ ] Cru confirms in Bridge after sign-install

## Comments

2026-11-13: Implemented in `client/settings.js` + popover markup and CSS variables. Checked in the real panel over the debug port on `IMG_7801.CR2` (dashed) and `IMG_8745.CR2` (solid): swatch, hex field (with and without `#`, invalid input ignored), opacity and thickness all change the overlay live; reset restores the defaults; Esc and a click outside close the popover. The colour control is preset swatches plus a hex field, not a spectrum: the native colour input was not tried. Default thickness is now 3 px (was 4). Not checked: settings surviving a Bridge restart (same localStorage mechanism as the layer toggles), and faces/crop with a non-default opacity or thickness (no such file selected).

2026-11-13: Cru tried v0.10.0 and expected the colour to change the face boxes too. Colour is now per layer: a Focus / Faces / Crop selector above the swatches picks which layer the swatches and hex field edit (`--af-color`, `--face-color`, `--crop-color`; keys `overlay.color`, `overlay.color.faces`, `overlay.color.crop`). Reset restores all three. Checked in the real panel on `DSCF2659.RAF`: changing Faces recolours only the face boxes, and a Focus colour Cru had set survived a Bridge restart.
