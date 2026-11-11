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
  -> client/main.js (Node/JS)       : asks exiftool, asks the registry, renders
  -> vendor/exiftool                : returns maker-note / AF tags as JSON, and
                                      the largest embedded image as the preview
  -> client/delegates/index.js      : registry: picks the delegate for the tags
  -> client/delegates/<mfr>.js      : computes AF box(es) in its own pixel frame
  -> SVG overlay                    : viewBox = that frame, stretched on the preview
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
    exiftool.js            spawn wrapper: readFocusData(file, tags) -> tags + preview
  delegates/
    index.js               registry: delegate list, tag union, delegateFor(tags)
    common.js              shared helpers: point types, default box, info line
    fujifilm.js            ported Fuji geometry (getAfPoints)
    dji.js                 DJI: preview + flight info, no AF data (none exists)
    sony.js                ported Sony geometry (FocusLocation)
    nikon.js               ported Nikon geometry (AF area, point names, CropHiSpeed)
    nikon-points.js        Nikon AF point maps (name -> x, y, w, h), generated data
    canon.js               ported Canon geometry (AF area lists, in-focus only)
    olympus.js             OM System / Olympus: primary focus area or point
vendor/exiftool/           bundled Windows exiftool 13.55 (complete standalone)
test/
  samples.test.js          `node --test`: every sample through its delegate
  samples/*.json           one per camera file: exiftool tags + expected boxes
tools/                     dev-only: ZXPSignCmd.exe + cert.p12 + sign-install.sh,
                           add-sample.js + fetch-samples.js (sample tests, below),
                           plus clipfix.cs (unshipped remedy, see blank-panel section)
reference/                 read-only porting sources (Lr plugin, digiKam)
fixtures/                  raw files, gitignored: Cru's own at the top level,
                           downloaded ones in pixls/, check images in check/
```

## Delegate contract (adding a manufacturer)

Adding a make is **one file in `client/delegates/` plus one line in the
`DELEGATES` list of `client/delegates/index.js`**. Neither `main.js` nor
`exiftool.js` names any manufacturer. A delegate is a pure module (no I/O, no
DOM, so the sample tests run it on plain Node) exporting:

- `matches(tags)` — true if it handles this file. First match in the list wins.
- `TAGS` — the exiftool tag names it reads. The registry asks exiftool for the
  union of every delegate's list plus a few common ones; wildcards work for
  numbered tags (`Face*Position`).
- `getAfPoints(tags)` — returns `{ frame: {width, height}, points, message? }`,
  or `null` for nothing to draw. Each point is a centre/size box
  `{pointType, x, y, width, height, primary?}` in the pixel space of `frame`,
  in the camera's native (unrotated) orientation. `frame` is whatever space the
  camera reports coordinates in (Fuji: `ExifImageWidth x ExifImageHeight`;
  most others: full-size image pixels). The panel sets the SVG `viewBox` to
  it and fits it centred over the preview (`xMidYMid meet`), so the preview's
  own pixel size never matters, and a frame that is a centred aspect-ratio
  crop of the preview (or the reverse) still lines up. `message` optionally
  explains an empty `points` (manual focus, no AF data).
- optional `formatShootingInfo(tags)` and `NO_AF_MESSAGE`.

`pointType` picks the layer and colour: contains `face` → Faces, `crop` →
Crop, anything else → Focus (see `common.js`). A type containing `selected`
is drawn dashed: a point the photographer chose whose focus the camera did not
confirm.

**Preview:** `exiftool.js` displays the largest embedded image a file has
(`JpgFromRaw`, `PreviewImage`, `OtherImage`, `ThumbnailImage`, by byte size),
so NEF/ARW/CR3 get their full-size JPEG. A JPEG file is displayed as itself.

## Sample tests (run outside Bridge)

`node --test` (system Node, from the repo root) feeds every
`test/samples/*.json` to its delegate and compares the boxes. A sample is the
exiftool tag snapshot of one real camera file plus the expected boxes; it needs
no Bridge, no exiftool and no raw file, so it also runs on a fresh checkout and
on the macOS CI job planned in `.scratch/public-release`. **Raw image files are
never committed** — `fixtures/` is gitignored and each sample records its
`source` (a URL, or "Cru's own").

Adding a camera body:

1. Put the raw in `fixtures/` (downloads go in `fixtures/pixls/`).
2. `node tools/add-sample.js fixtures/pixls/<name>.ARW --source <url>` writes
   `test/samples/<name>.json` and a check image `fixtures/check/<name>.jpg`
   (boxes drawn on the embedded preview; needs the dev-only ImageMagick).
   Samples are named `<make>-<body>[-<what>]`; for a file with a camera name
   such as `DSCF2714.RAF`, pass `--name fuji-x-h2-dscf2714`.
3. **Look at the check image.** Nothing else confirms the box is in the right
   place; the expected output is only a regression baseline.
4. `node --test`, then commit the `.json`.

Other uses: `node tools/add-sample.js test/samples/<name>.json` recomputes
`expected` from the sample's own tags (after an intended geometry change, or a
hand-edited sample); `node tools/fetch-samples.js` re-downloads every raw whose
source is a URL. The snapshot tool redacts camera serial numbers.

## How the Fuji geometry works (the ported core)

Ported from `reference/focuspoints.lrplugin/FujifilmDelegates.lua`
(`getAfPoints`) into `client/delegates/fujifilm.js`. For the X-series / GFX:

- `FocusPixel` is a single `(x, y)` in the coordinate system of the **embedded
  JPEG**, whose dimensions are reported by `ExifImageWidth`/`ExifImageHeight`.
- The delegate returns that as its `frame` and leaves the point unscaled. The
  default box is a square of side `min(frameW, frameH) * 0.04` (the Lr "medium"
  default) centred on the point.
- **We render the embedded preview**, extracted with exiftool. On the X-H2 that
  preview is exactly `ExifImageWidth x ExifImageHeight` (4416x2944 on the test
  bodies). The SVG overlay's `viewBox` is the frame, so coordinates stay in
  frame space regardless of preview size or on-screen zoom.
- Faces (`FacesDetected`/`FacesPositions`), subject detection
  (`FaceElementPositions`, exiftool >= 12.44) and tele-converter crop
  (`CropSize`/`CropTopLeft`, >= 12.82) use the same scale and are already ported.
  None of the current fixtures exercise them.

**Manual focus:** with `FocusMode2` = AF-M the camera still writes
`FocusPixel` (where the focus frame was parked), but the delegate shows
"manual focus" and no box, like every other make.

**Bodies sampled** (the delegate needed no per-body changes: every body uses
`FocusPixel` in the `ExifImage*` frame, which is 4416x2944 on the X bodies and
4000x3000, 4:3, on the GFX):

| Body | Sample | Checked by eye |
|---|---|---|
| X-H2 | `fuji-x-h2-dscf*` (Cru's own: portrait + faces, 16:9 crop, OOC JPEG) | yes, and in Bridge |
| X-T5 | `fuji-x-t5`, `fuji-x-t5-mf` (manual focus) | yes |
| X-T4 | `fuji-x-t4` | yes |
| X-T3 | `fuji-x-t3` | manual focus only: both raw.pixls.us files are MF |
| GFX 100S II | `fuji-gfx100s-ii` (off-centre) | yes |
| GFX 100S | `fuji-gfx100s` | yes |
| GFX 50S II | `fuji-gfx50s-ii` | yes |
| GFX 50R | `fuji-gfx50r` (wide/tracking, off-centre) | yes |

The X-T3 is **untested for autofocus**. None of the downloaded samples has
face data; Fuji faces are covered by the X-H2 sample only.

**OOC caveat:** the `FocusPixel`/`ExifImageWidth` reference is lost or corrupted
on RAF->DNG conversion. Feed straight-out-of-camera `.RAF` (or the OOC JPEG).
`fujifilm.js` rejects DNGs (`FileType`) and files missing `InternalSerialNumber`,
with a status message instead of a box.

### Tag access convention

exiftool is invoked with `-json -s`, so tag keys are short PascalCase
(`FocusPixel`, `ExifImageWidth`, `FacesDetected`, `InternalSerialNumber`).
Delegates read tags by those names. `FocusPixel` comes back as the string
`"2515 1164"`; dimensions come back numeric.

## Orientation handling (done — and NOT in the delegate)

AF coordinates are relative to the camera's native (unrotated) orientation.
Rotated/portrait shots are handled, but **not** the way the Lr plugin does it.
Because we draw a live SVG overlay (not Mogrify-baked pixels), we don't rotate
each point — we rotate the *whole image+overlay container* and leave the points
in native space. The delegate is orientation-agnostic and untouched. The logic
lives entirely in `client/main.js` + `styles.css`:

- `#preview` gets CSS `image-orientation: none` so CEF never auto-rotates from
  the extracted preview's own Orientation tag. This is essential: a RAF's
  embedded preview carries an Orientation tag (CEF would rotate it) while an OOC
  JPEG's tiny preview does not (CEF would leave it sideways) — so without this we
  get inconsistent behavior between the two. Forcing `none` makes the decoded
  pixels always native, and `naturalWidth/Height` always the native frame.
- `orientationOf(tags)` maps the exiftool `Orientation` string to `{rotate,
  mirror}`; `layout()` fits the native preview into the stage (swapping bounds
  for 90/270 so the *rotated* footprint fits) and applies the same CSS
  `transform` to image and overlay so they rotate as one unit about a shared
  centre. The SVG `viewBox` stays in native pixel space, so faces/crop boxes ride
  along for free.
- Mirrored EXIF variants (2/4/5/7) are implemented but not yet visually verified
  (no mirrored fixture). The four rotations (incl. `Rotate 270 CW`, the
  `DSCF2659` fixtures) are verified in Bridge.

**JPEGs are displayed as themselves**, not via their embedded `PreviewImage`
(a small letterboxed thumbnail, e.g. 640×480 4:3 for a 3:2 frame, which used to
put the box slightly off). Real in-camera crop (`CropSize`/`CropTopLeft`,
digital tele-converter) is drawn but untested. Getting the box in the wrong place
is almost always a transform bug, not a parse bug.

## ⚠️ Bridge 2026 requires a SIGNED extension (the big gotcha)

Bridge 2026 (16.0.3, CEP 12) **will not render an unsigned CEP extension**. (This
was originally recorded as "even with `PlayerDebugMode=1`", but that value never
reached Bridge — see the sandbox note below — so real debug mode is untested.)
It *lists* the extension in Window > Extensions but
loading fails — an `Embedded` panel **hard-crashes Bridge** ("A nullptr was
dereferenced"), and dialog types (`Modeless`/`ModalDialog`) show "Unable to
load". The CEP log only says "Signature verification failed". The built-in
`HelloBridge` sample works **because it is code-signed**. Note: the symptoms
differ by `UI Type` but the cause is the same (unsigned). Once signed, **all
types work — including `Embedded`, which we ship** (it docks like the native
Metadata panel). The earlier "Embedded crashes" was just the unsigned rejection.

Consequence baked into the project:

- **Every install must be signed.** `tools/sign-install.sh` does it: stage the
  shippable dirs → `ZXPSignCmd -sign` with a self-signed cert
  (`tools/cert.p12`) → unzip the `.zxp` into
  `%APPDATA%\Adobe\CEP\extensions\com.cru.bridgefocuspoints`. A self-signed cert
  is enough on its own — Bridge loads it with no `PlayerDebugMode` set. **Editing any file invalidates
  the signature — re-run the script after every change.** (`tools/ZXPSignCmd.exe`
  is Adobe's official 4.1.103 build; dev-only, never shipped.)
- **Claude runs the install, not Cru.** `bash tools/sign-install.sh` works in
  Claude's environment, so whenever a change is ready to test in Bridge, Claude
  runs the sign-install script itself and *then* asks Cru to test — never tell
  Cru to run it. Cru's only manual steps are restarting Bridge and reporting what
  the panel shows.

## ⚠️ Blank panel: never force CEF into software rendering

**The manifest passes no GPU flags, and must stay that way.** `CEFCommandLine`
holds `--enable-nodejs` only, so the panel is GPU-composited like Adobe's own.
Verified 2026-11-11 on Bridge 16.0.8: six normal launches in a row GPU-rendered
and drawn, and the panel stayed drawn through a tab switch and a
minimise/restore.

**Why software rendering goes blank (confirmed by switching it off and on
against a live Bridge).** Bridge docks a CEP panel inside a
`DroverLord - TabPanel Window` created **without `WS_CLIPCHILDREN`**. Whenever
Bridge repaints that window it paints over the panel's area. A GPU-composited
panel is unaffected — its frames are a separate DirectComposition surface above
the window. A software-composited one keeps its pixels in the same surface, so
they are wiped: the page is fully alive (a CDP `Page.captureScreenshot` is
perfect) and the screen shows a flat RGB(50,50,50), PlugPlug's panel
background. It may draw for an instant after a selection change, then vanish.

**History, so it is not repeated.** `--disable-gpu-compositing` (Jul 2026),
then `--disable-gpu` and `--disable-direct-composition` (Sep 2026), were each
added as a "fix" for a blank panel and each declared working after one good
restart. They were the cause of the recurring blank panel, not the cure: on
2026-11-11 the same three flags gave blank and drawn launches minutes apart.
The ANGLE/Vulkan `GL is disabled` errors they produce are just CEF's software
fallback failing to start, and appear whether or not the panel is visible.
Removing all three is what fixed it. A single "it works now" after a restart is
not evidence here — switch the suspected cause off and on again.

**If a machine can only do software rendering** (CEF falls back by itself when
it has no usable GPU), the overpaint above should apply and the panel would be
blank there. That is untested — it has only been seen with the flags. The known
remedy is `tools/clipfix.cs`: a small helper that sets `WS_CLIPCHILDREN` on the
tab panel and keeps it set (measured with the panel in software mode: drawn
0/12 without it, 12/12 with it; of the three ancestor windows lacking the
style, only the tab panel matters). It is deliberately **not shipped** — it is
an extra executable that modifies Bridge's windows, which is the wrong default
for a distributable extension. Its header says how to wire it back in.

**Two things still unexplained:**

- Default GPU compositing was reported blank on this VM in July 2026 (Bridge
  16.0.6); that is what started the flags. The cause was never established and
  it has not recurred on 16.0.8.
- A second blank mode: PlugPlug's content window (the GUID-class child of
  `WC_PLUGPLUG_HTMLEXTENSION_CLASS_NAME`) is left hidden at the manifest's
  default 800×600, so the page reports 534×400 at 150 % and never resizes. Seen
  2026-09-20 and on the first two launches of 2026-11-11 (both with the flags,
  both straight after a VM boot/crash); not reproduced since. In a good launch
  PlugPlug logs `InitContent begin/end` for the extension about a second after
  the engine's `ClientInitialized` RPC — that step shows and sizes the window,
  so that is the line to look for (needs `LogLevel` 6, see the sandbox note).

**Diagnose before changing plugin code:**

1. `curl http://localhost:8088/json` → the page's `webSocketDebuggerUrl`, then
   drive CDP from Node (global `WebSocket`, no deps): `Runtime.evaluate` for the
   DOM and `innerWidth`, `Page.captureScreenshot` for pixels. A correct
   screenshot with a blank pane means the problem is outside the page.
2. `Get-CimInstance Win32_Process` on `CEPHtmlEngine.exe`: the `gpu-process`
   command line containing `--use-gl=disabled` means CEF is in software mode.
3. `PrintWindow(hwnd, hdc, PW_RENDERFULLCONTENT)` on Bridge's top-level window
   is a truthful capture of what is on screen even when Bridge is covered
   (checked against a real `BitBlt` of the desktop). It returns nothing useful
   while Bridge is minimised — check `IsIconic` first.
4. If the content window is hidden / 800×600, it is the second mode above.

### Sandbox note: a Claude session does not see Bridge's registry

The Claude desktop app is an MSIX package, so registry writes made from a
session land in the package's private hive. Bridge, launched normally, never
sees them — and a Bridge *started from a session* does, so it behaves
differently from the one Cru runs.

- `PlayerDebugMode=1` and `LogLevel=6` under `HKCU\Software\Adobe\CSXS.12`
  exist only in that private hive (written 2026-06-22). The real key holds just
  `LogLevel=1`, unchanged since Bridge was installed. So debug mode has never
  been on for Cru's Bridge; the self-signed extension loads and `.debug` opens
  port 8088 regardless.
- To run something as the real user from a session, hand it to Explorer:
  `explorer.exe "C:\path\to\thing.cmd"`. Always start Bridge that way when
  testing; a directly spawned Bridge reads the private hive (verbose logging,
  different timing) and is not a valid test.

## Selection updates by polling, not events

Bridge's ExtendScript selection-changed event is unreliable, so `client/main.js`
**polls** `getSelectedFile()` (~600 ms) and only re-runs exiftool/render when the
path changes. `host/index.jsx` still dispatches a `CSXSEvent` too, but that is a
bonus path — polling is what actually drives live updates.

## Status

Working end-to-end in Bridge: select a Fuji RAF → preview + green AF box render
on the focus point, and the panel updates live as the selection changes.
Sony, Nikon (Z and DSLR), Canon and OM System / Olympus delegates were added
on 2026-11-11 and pass their sample tests (`node --test`). One file per make
was run through the real panel in Bridge 16 by Claude over the debug port
(state read back plus a CDP screenshot: A7R III, Z6, Z6 III 1:1 crop, D810,
R10 portrait, 80D, E-M5 III, GFX 100S II, the X-H2 RAF + JPEG, DJI). **Cru has
not yet looked at them himself**; the per-make notes below say what each
sample covers.
exiftool bundle verified (13.55); Fuji primary-point geometry ported & visually
verified against Cru's X-H2 fixtures (`fixtures/expected/*-afbox.jpg`); signed
`Embedded` panel docks in Bridge 2026 like a native panel. Faces / AI subject
boxes confirmed working with live data. **Orientation** (incl. portrait
`Rotate 270 CW`) verified on the `DSCF2659` fixtures.

Bottom-bar UI: per-layer toggles (Focus / Faces / Crop, persisted via
localStorage; a layer with no data in the current image is greyed/disabled) and
a shooting-info readout (model · focal · aperture · shutter · ISO · focus-mode ·
AF area+size · detected subject). Toggling re-renders the cached result; no
re-run of exiftool.

Crop: **aspect-ratio crop** (`RawImageAspectRatio`, e.g. 16:9 → centred dashed
box, trim top/bottom) verified on `DSCF2561.RAF`. Digital tele-converter crop
(`CropSize`/`CropTopLeft`) is drawn but still untested (no fixture). The two are
mutually exclusive in the delegate (TC crop wins).

AF-frame size: the green box is sized from the camera's real Single-Point
`AFAreaPointSize` ordinal via the tunable `AF_POINT_SIZE_FRACTION` table in
`fujifilm.js` (each step = +2% of the short side), falling back to the fixed
`FOCUS_BOX_SIZE` when absent. **Relative** sizing verified across fixtures
(SP 3 < 5 < 6); **absolute** scale is an unconfirmed approximation — needs
in-camera ground-truth testing to calibrate the table. No prior art: neither the
Lr nor digiKam ports use this ordinal at all.

**DJI** (`client/delegates/dji.js`): no geometry exists to port — the Lr plugin
and digiKam have zero DJI support, and exiftool decodes no DJI AF tags; the only
focus-related output is `AFDebugInfo`, an undecoded 256-byte binary blob.
Diffing the three Air 2S (FC3411) fixtures (`DJI_0426/0638/0685.DNG`): u32s at
0x00/0x08 constant (18, 200), 0x10/0x14 always 0x7FFF ("invalid"), and only
0x04 (68–77), 0x0C (76–78) and 0xD0 (2600/2700 — likely focus-motor position)
vary, drifting like AF metrics rather than swinging like tap-to-focus
coordinates. No field looks like a focus *position*; deciding for sure needs
two shots with focus deliberately tapped at opposite corners. The delegate
therefore draws nothing by design: it renders the DNG's embedded 960×630
SubIFD1 preview, a drone-flavoured info bar (model-code map FC3411→Air 2S etc.,
35mm-eq focal, AGL altitude, gimbal pitch from XMP-drone-dji), and an honest
"DJI does not record AF-point coordinates" status. Its `matches(tags)` also
claims Mavic 2/3 files, which report Make=Hasselblad. Decoding `AFDebugInfo` would need several
samples with known (tap-to-focus) positions to diff.

**Sony** (`client/delegates/sony.js`, ported from `SonyDelegates.lua`):
`FocusLocation` ("W H X Y") gives both the frame and the point; the box is
sized from `FocusFrameSize` where the body records it (A7R V, A7 IV, a6700),
the default box otherwise. All-zero `FocusLocation` falls back to the first
focal-plane phase-detect point. `FocusMode` = Manual shows "manual focus" and
no box. Faces (`FaceNPosition`) are ported but unverified: no sample has one.
The Lr plugin's centring shift for non-native aspect ratios is left to the
panel's centred frame fit, also unverified on a real 16:9 file. Inactive
phase-detect points are not drawn.

| Body | Sample | Checked by eye |
|---|---|---|
| A7R V | `sony-a7r5` (APS-C crop mode, camera-sized frame) | yes |
| A7R IV | `sony-a7r4` | yes |
| A7R III | `sony-a7r3` (flexible spot, off-centre) | yes |
| A7R II | `sony-a7r2` | manual focus only: every raw.pixls.us file is MF |
| A7 IV | `sony-a7m4` (APS-C crop mode, tracking) | yes |
| A7 III | `sony-a7m3` (centre point) | yes |
| A7 II | `sony-a7m2` | manual focus only: every raw.pixls.us file is MF |
| a6700 | `sony-a6700` (centre) | yes |
| a6600 | `sony-a6600` | yes |
| a6400 | `sony-a6400` | yes |

So the A7R II and A7 II are **untested for autofocus**; whether they record
`FocusLocation` in AF is unknown (the A7R II writes it even in MF).

**Nikon Z** (`client/delegates/nikon.js`, the contrast-AF path of
`NikonDelegates.lua`): `AFAreaXPosition/YPosition/Width/Height` are the focus
area in the pixels of `AFImageWidth x AFImageHeight`, which is the frame. The
same path covers DSLRs shot in live view. `FocusMode` = Manual shows "manual
focus". The info line includes `FocusDistance` (useful for telling the frames
of a focus stack apart; whether to show it for every make is still the open
question in the spec).

In-camera crop (`CropHiSpeed`): the area is moved into the cropped image by
scaling about the centre by the *larger* of the two crop ratios. This
**deviates from the Lr plugin** for 16:9 and 1:1, where Lr scales each axis
separately. Reason: real Z6 III files keep the area size (163x174) in 16:9 and
1:1 and enlarge it only in DX, so those modes crop without magnifying. For DX
the two formulas are identical. Every crop sample is a centre point, where
both agree, so **off-centre points in 16:9/1:1 are unverified**.

**Faces are unavailable for Nikon**: exiftool exposes no face positions for
these bodies (only `SubjectDetection`), and the Lr plugin has none either.
With subject detection on, the AF area is normally the subject's box anyway.

| Body | Sample | Checked by eye |
|---|---|---|
| Z8 | `nikon-z8` (auto-area: 49 named points via the Z9 map, see Nikon DSLR) | yes |
| Z7 II | `nikon-z7ii` (off-centre) | yes |
| Z7 | `nikon-z7` (off-centre) | yes |
| Z6 III | `nikon-z6iii`, `-dx`, `-16x9`, `-1x1` (pinpoint, centre) | yes |
| Z6 II | `nikon-z6ii` (centre) | yes |
| Z6 | `nikon-z6` (off-centre) | yes |
| Z50 II | `nikon-z50ii`, `-16x9` (3D-tracking) | yes |
| Z50 | `nikon-z50` (centre) | yes |
| Zfc | `nikon-zfc` (auto-area, off-centre) | yes |

**Canon** (`client/delegates/canon.js`, ported from `CanonDelegates.lua`):
the camera lists every AF area (`AFAreaXPositions/YPositions/Widths/Heights`)
in the `AFImageWidth x AFImageHeight` frame, measured from the frame centre
with Y up; the delegate converts to top-left origin and draws only the areas
named in `AFPointsInFocus`. One box gets the centre cross; several (auto-area
on a DSLR, whole-area on an R body) are all drawn without one.
**When no area is in focus, the areas in `AFPointsSelected` are drawn
instead, dashed** (`af_selected`), with the status "selected AF point shown,
focus not confirmed". This is our addition, not in the Lr plugin, and it is
what makes Canon useful for tripod work: across 783 of Cru's 80D frames about
90% record a selected point but no in-focus one (live view Flexizone, or
back-button AF released before the shutter). The same code
serves CR2 DSLRs and CR3 mirrorless. `FocusMode` "Manual Focus…" shows
"manual focus". The only model quirks carried over from Lr are the original
EOS 5D's image size and the flipped Y axis on compacts; neither is a target
body and neither has a sample.

**Faces are unavailable for Canon**: exiftool exposes no face positions for
these bodies (only settings such as `SubjectToDetect` / `EyeDetection`), and
the Lr plugin has none. With subject detection on, the in-focus area is the
subject's box (see the R7 and R10 samples).

| Body | Sample | Checked by eye |
|---|---|---|
| R5 Mark II | `canon-r5ii` (spot AF) | yes |
| R5 | `canon-r5` (spot AF) | yes |
| EOS R | `canon-r` (servo, live view) | yes |
| 5D Mark IV | `canon-5d4` (single point) | yes |
| 5D Mark III | `canon-5d3` (single point) | yes |
| R6 Mark II | `canon-r6ii` (whole area, 7 areas) | yes |
| R6 | `canon-r6` | manual focus only: every raw.pixls.us file tried is MF |
| R7 | `canon-r7` (subject box) | yes |
| R10 | `canon-r10` (portrait, subject box) | yes |
| 90D | `canon-90d` (single point) | yes |
| 80D | `canon-80d` (auto-area, 44 areas in focus); Cru's own `canon-80d-img7801` (selected point only), `-img8745` (in focus), `-img8272` (portrait) | yes, and in Bridge |
| 70D | `canon-70d` (single point) | yes |
| 77D | `canon-77d` (auto-area, 5 areas) | yes |
| 7D Mark II | `canon-7d2` (single point) | yes |
| 6D Mark II | `canon-6d2` (live view) | yes |

The R6 is **untested for autofocus**.

**Nikon DSLR** (viewfinder AF, the phase-detect path of `NikonDelegates.lua`,
in the same `nikon.js`): these bodies record point *names* (`C6`, `E9`), not
coordinates. `client/delegates/nikon-points.js` holds the per-model maps
(converted from the Lr plugin's `focus_points/nikon corporation/*.txt`), and
`MODEL_MAP` in `nikon.js` says which model uses which. `PrimaryAFPoint` is
drawn with the centre cross; any other used points are drawn as plain boxes.
The D850 generation (`AFInfo2Version` 0101: D850, D500, D7500) picks its tag
by AF-area mode as Lr does: `AFPointsSelected` for single / group / dynamic,
`AFPointsInFocus` for auto and 3D-tracking; everything else uses
`AFPointsUsed`. In-camera crop shifts the points by half the size difference
(the viewfinder is not magnified). A Nikon with point names but no map shows
"this Nikon model is not supported yet". Viewfinder AF records no faces. The
inactive-point grid is not drawn. The Z8 and Z9 use this path in auto-area AF,
with the Z9 map, as in the Lr plugin.

**Adding another Nikon DSLR:** convert its Lr `.txt` map into
`nikon-points.js` (same shape as the others), add the model to `MODEL_MAP`,
and add a sample.

| Body | Sample | Checked by eye |
|---|---|---|
| D850 | `nikon-d850` (manual focus), `nikon-d850-af-edited` | AF path on hand-edited tags only: every raw.pixls.us file is MF |
| D810 | `nikon-d810` (point A5), `nikon-d810-dx-edited` (crop offset, hand-edited) | yes (the real one) |
| D800 | `nikon-d800` (centre; from rawsamples.ch) | yes |
| D800E | `nikon-d800e` (centre) | yes |
| D500 | `nikon-d500` (manual focus), `nikon-d500-af-edited` | AF path on hand-edited tags only: every raw.pixls.us file is MF |
| D7500 | `nikon-d7500` (dynamic area, centre) | yes |

So the **D850 and D500 are untested on a real autofocus file**, and the DSLR
crop offset is covered only by a hand-edited sample. `nikon-d750-nomap-edited`
covers the no-map status.

**OM System / Olympus** (`client/delegates/olympus.js`, the primary-focus path
of `OlympusDelegates.lua`; matches Make "OLYMPUS…" and "OM Digital
Solutions"). First hit wins: `AFFocusArea` in `AFFrameSize` units (OM System
bodies, the area actually in focus); else `AFPointSelected` read numerically
(`AFPointSelected#`, fractions of the image, default box); else `AFAreas`
(1/256ths). Subject-detect frames (`SubjectDetectArea`/`Detail`) go on the
Faces layer. `FocusMode` starting "MF" shows "manual focus". The info line
adds `FocusDistance` and `StackedImage` when the camera focus-stacked.
Not ported: the selected-but-not-in-focus target area, and face frames
(`FaceDetectArea` needs Lr's long per-model decoding).

**This make is the least verified.** Nearly every OM/Olympus file on
raw.pixls.us is a manual-focus chart shot (20 files tried across the six
bodies):

| Body | Sample | Checked by eye |
|---|---|---|
| OM-1 Mark II | `om-1ii` | manual focus only (5 files tried) |
| OM-1 | `om-1` (AF, but focus not confirmed: no area), `om-1-af-edited` | `AFFocusArea` path on hand-edited tags only |
| E-M1 Mark III | `olympus-e-m1iii` | manual focus only (3 files tried) |
| E-M1 Mark II | `olympus-e-m1ii` | manual focus only (4 files tried) |
| OM-5 | `om-5` | manual focus only (3 files tried) |
| E-M5 Mark III | `olympus-e-m5iii` (`AFPointSelected`, off-centre) | yes |

So only the `AFPointSelected` path is confirmed on a real file. The OM System
`AFFocusArea` path and the subject-detect frames need a real autofocus ORF.

**Unsupported cameras degrade gracefully**: no delegate is no longer fatal —
the panel still renders the embedded preview (or, for JPEGs with no embedded
PreviewImage, the file itself) plus the generic shooting-info line, with a
"<Make> is not supported yet" status. Only the overlay needs a delegate.

Not yet done / next steps:
- Real autofocus files for the bodies listed above as manual-focus-only or
  hand-edited: Sony A7R II / A7 II, Canon R6, Fuji X-T3, Nikon D850 / D500, and
  every OM System / Olympus body except the E-M5 III. Add each with
  `tools/add-sample.js` and look at its check image.
- Unverified geometry: Sony faces and non-3:2 aspect, Nikon off-centre points
  in 16:9 / 1:1 crop, Nikon DSLR crop offset, OM System `AFFocusArea` and
  subject-detect frames.
- Calibrate `AF_POINT_SIZE_FRACTION` against real in-camera AF-frame testing
  (absolute scale only; shape confirmed). Zone mode (`AFAreaZoneSize`) unmodelled.
- Mirrored EXIF orientations (2/4/5/7) — coded, no fixture to verify.
- Digital-TC crop test.
- Distinguish face-element types (Head/Body/Face/Eye via `FaceElementTypes`)
  instead of drawing all as one yellow box; also `FacePositions` vs the
  delegate's `FacesPositions` tag-name mismatch (latent dead branch).
- Other makes (Panasonic, Pentax, …) only on request; each is one delegate file.
- A proper `.zxp` for distribution (the dev self-sign is fine for personal use).

## Install / debug (Windows VM)

1. No registry change is needed: the signed extension loads without
   `PlayerDebugMode` (it has never been set in Cru's real registry — see the
   sandbox note above). Only set it, by hand in `regedit`, if you want to test
   real CEP debug mode.
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

- **System Node is installed** now (v26.3.1, `C:\Program Files\nodejs`), so
  delegate JS can be exercised outside Bridge, and it is what drives the CDP
  debugging described above. At runtime the panel still uses CEP's bundled Node.
- exiftool: `vendor/exiftool/exiftool.exe` (complete standalone, 13.55). The
  copy originally dropped in was missing its Perl runtime; it was replaced with
  the complete bundle from the Lr plugin's `bin/`.
- ImageMagick (`reference/focuspoints.lrplugin/bin/ImageMagick/magick.exe`) is
  used **only** for dev-time fixture verification (drawing oracle boxes), never
  shipped or required at runtime.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/` in this repo (no GitHub Issues). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage roles, label string = role name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as each issue file's `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root (created lazily). See `docs/agents/domain.md`.
