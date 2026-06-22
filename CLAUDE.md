# Bridge Focus Points

A CEP plugin for Adobe Bridge that reads the camera's autofocus point(s) from
maker-note metadata and draws them as an overlay on the selected photo. The
Bridge equivalent of digiKam's native display and the Focus-Points Lightroom
plugin.

Full design rationale lives in [project.md](project.md). This file is the
working reference for how the code is actually put together.

## The one idea that makes this tractable

**We do not parse maker notes.** That problem is solved twice already and we
delegate to both:

- **exiftool** (bundled, shelled out) does all metadata extraction.
- **The Focus-Points Lr plugin** holds the per-manufacturer geometry that turns
  exiftool output into pixel coordinates. We port that, manufacturer by
  manufacturer (Lua -> JS). digiKam (`reference/digikam-focuspoint-metadataengine/`)
  is a secondary cross-reference only — it uses Exiv2, not exiftool, so its
  extraction layer does not transfer.

## Architecture (decided — do not re-evaluate)

- **CEP**, not UXP (Bridge has no UXP). Host id `KBRG`. Bridge 16 ships CEP 12.
- **Node.js enabled** in the panel (`--enable-nodejs --mixed-context` in the
  manifest) so we can `child_process` to exiftool. CEP 12 ships Node 17.7.1.
- **Bundled exiftool**, shelled out. Never reimplement.
- **HTML `<img>` + SVG overlay** for rendering (resolution-independent; drops
  the Lr plugin's ImageMagick dependency).
- **Windows** target (Cru runs Adobe in a Windows VFIO VM). Mac later.

### Data flow

```
Bridge selection
  -> host/index.jsx (ExtendScript)  : reports selected file path; pings panel on change
  -> client/main.js (Node/JS)       : spawns exiftool, picks delegate, renders
  -> vendor/exiftool                : returns maker-note / AF tags as JSON
  -> client/delegates/<mfr>.js      : computes AF box(es) in image-pixel coords
  -> SVG overlay                    : draws the box(es) on the preview
```

ExtendScript (ES3) is the *only* thing that can talk to Bridge but is feeble, so
`host/index.jsx` stays tiny: it answers "what file is selected?" and dispatches a
`CSXSEvent` (`com.cru.bridgefocuspoints.selectionChanged`) when the selection
changes. Everything else is in the Node/JS panel. The two talk via
`CSInterface.evalScript()` and CSXS events.

## Layout

```
CSXS/manifest.xml          extension config, host KBRG, Node enable
.debug                     remote-debug port 8088
host/index.jsx             ExtendScript: selection -> path (+ change event)
client/
  index.html               panel shell
  main.js                  Node/JS: exiftool -> delegate -> SVG overlay
  styles.css
  lib/
    CSInterface.js         Adobe CEP 12 library (vendored)
    exiftool.js            spawn wrapper: readTags() / extractPreview()
  delegates/
    fujifilm.js            ported Fuji geometry (getAfPoints)
vendor/exiftool/           bundled Windows exiftool 13.55 (complete standalone)
tools/                     dev-only: ZXPSignCmd.exe + cert.p12 + sign-install.sh
reference/                 read-only porting sources (Lr plugin, digiKam)
fixtures/                  test RAFs; expected/ holds rendered AF-box oracles
```

## How the Fuji geometry works (the ported core)

Ported from `reference/focuspoints.lrplugin/FujifilmDelegates.lua`
(`getAfPoints`) into `client/delegates/fujifilm.js`. For the X-series / GFX:

- `FocusPixel` is a single `(x, y)` in the coordinate system of the **embedded
  JPEG**, whose dimensions are reported by `ExifImageWidth`/`ExifImageHeight`.
- The transform is a pure scale to the displayed image:
  `xScale = displayW / ExifImageWidth`, same for y. The box is a square of side
  `min(displayW, displayH) * 0.04` (the Lr "medium" default) centred on the
  scaled point.
- **We render the embedded preview**, extracted with exiftool. On the X-H2 that
  preview is exactly `ExifImageWidth x ExifImageHeight` (4416x2944 on the test
  bodies), so `xScale = yScale = 1.0` and `FocusPixel` maps directly. The SVG
  overlay uses `viewBox="0 0 imgW imgH"` so coordinates are in image-pixel space
  regardless of on-screen zoom.
- Faces (`FacesDetected`/`FacesPositions`), subject detection
  (`FaceElementPositions`, exiftool >= 12.44) and tele-converter crop
  (`CropSize`/`CropTopLeft`, >= 12.82) use the same scale and are already ported.
  None of the current fixtures exercise them.

**OOC caveat:** the `FocusPixel`/`ExifImageWidth` reference is lost or corrupted
on RAF->DNG conversion. Feed straight-out-of-camera `.RAF` (or the OOC JPEG).
`fujifilm.makerNotesFound()` rejects DNGs and files missing `InternalSerialNumber`.

### Tag access convention

exiftool is invoked with `-json -s`, so tag keys are short PascalCase
(`FocusPixel`, `ExifImageWidth`, `FacesDetected`, `InternalSerialNumber`).
Delegates read tags by those names. `FocusPixel` comes back as the string
`"2515 1164"`; dimensions come back numeric.

## #1 correctness pitfall — orientation/crop

AF coordinates are relative to the camera's native orientation. The current
three fixtures are all `Horizontal (normal)`, so the v1 slice assumes an upright
preview. **Rotated/cropped images are not handled yet** — that is the next
correctness task. The Lr plugin does this in the delegates plus `Crop.lua` /
`Straighten.lua` / its orientation logic; study those before adding it. Getting
the box in the wrong place is almost always a transform bug, not a parse bug.

## ⚠️ Bridge 2026 requires a SIGNED extension (the big gotcha)

Bridge 2026 (16.0.3, CEP 12) **will not render an unsigned CEP extension**, even
with `PlayerDebugMode=1`. It *lists* the extension in Window > Extensions but
loading fails — an `Embedded` panel **hard-crashes Bridge** ("A nullptr was
dereferenced"), and dialog types (`Modeless`/`ModalDialog`) show "Unable to
load". The CEP log only says "Signature verification failed". The built-in
`HelloBridge` sample works **because it is code-signed**.

Two consequences baked into the project:

- **We ship `Type=Modeless`**, not `Embedded` (Embedded crashes here). Modeless
  is a floating, non-blocking window — fine for live browsing.
- **Every install must be signed.** `tools/sign-install.sh` does it: stage the
  shippable dirs → `ZXPSignCmd -sign` with a self-signed cert
  (`tools/cert.p12`) → unzip the `.zxp` into
  `%APPDATA%\Adobe\CEP\extensions\com.cru.bridgefocuspoints`. A self-signed cert
  is enough because `PlayerDebugMode` is honored. **Editing any file invalidates
  the signature — re-run the script after every change.** (`tools/ZXPSignCmd.exe`
  is Adobe's official 4.1.103 build; dev-only, never shipped.)

## Selection updates by polling, not events

Bridge's ExtendScript selection-changed event is unreliable, so `client/main.js`
**polls** `getSelectedFile()` (~600 ms) and only re-runs exiftool/render when the
path changes. `host/index.jsx` still dispatches a `CSXSEvent` too, but that is a
bonus path — polling is what actually drives live updates.

## Status

Working end-to-end in Bridge: select a Fuji RAF → preview + green AF box render
on the focus point, and the panel updates live as the selection changes.
exiftool bundle verified (13.55); Fuji primary-point geometry ported & visually
verified against all three fixtures (`fixtures/expected/*-afbox.jpg`); signed
`Modeless` panel loads in Bridge 2026.

Not yet done / next steps:
- Orientation + crop handling (current fixtures are all upright).
- Faces / subject-detection display validated against real fixtures.
- Remaining manufacturers (Canon, Nikon, Sony, …), one at a time.
- A proper `.zxp` for distribution (the dev self-sign is fine for personal use).

## Install / debug (Windows VM)

1. Enable debug mode: `regedit` ->
   `HKEY_CURRENT_USER\Software\Adobe\CSXS.12`, add string `PlayerDebugMode` = `1`.
   (Required, but NOT sufficient on its own — the extension must also be signed,
   see above.)
2. Build + sign + install: run `bash tools/sign-install.sh` from the repo. It
   installs only the shippable dirs (`CSXS/`, `client/`, `host/`, `vendor/`,
   `.debug`) — never `reference/` or `fixtures/`. `client/lib/exiftool.js` finds
   the binary at `<extension-root>/vendor/exiftool/exiftool.exe`.
3. Restart Bridge (fully quit first). Open from **Window > Extensions > Focus
   Points**.
4. DevTools: with the `.debug` file present, browse to `http://localhost:8088`
   in Chrome/Edge. CEP logs: `%TEMP%\CEP12-KBRG.log`; Bridge's own log:
   `%APPDATA%\Adobe\Bridge 2026\BridgeLog.log`.

## Tooling notes

- **No system Node** on the dev machine — the panel uses CEP's bundled Node, so
  that is fine at runtime. It means the delegate JS cannot be unit-tested via a
  plain `node` invocation here without installing Node first.
- exiftool: `vendor/exiftool/exiftool.exe` (complete standalone, 13.55). The
  copy originally dropped in was missing its Perl runtime; it was replaced with
  the complete bundle from the Lr plugin's `bin/`.
- ImageMagick (`reference/focuspoints.lrplugin/bin/ImageMagick/magick.exe`) is
  used **only** for dev-time fixture verification (drawing oracle boxes), never
  shipped or required at runtime.
```
