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
    dji.js                 DJI: preview + flight info, no AF data (none exists)
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

**Crop caveat (open):** an OOC JPEG's embedded `PreviewImage` can be a small
letterboxed thumbnail (e.g. 640×480 4:3 for a 3:2 frame), so `FocusPixel`/dim
scaling is slightly off on the *JPEG* path. The RAF preview is a clean full-frame
3:2 and maps exactly — feed RAFs. Real in-camera crop (`CropSize`/`CropTopLeft`,
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
exiftool bundle verified (13.55); Fuji primary-point geometry ported & visually
verified against all three fixtures (`fixtures/expected/*-afbox.jpg`); signed
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
"DJI does not record AF-point coordinates" status. Delegates may now provide
optional `matches(tags)` (dispatch; Mavic 2/3 report Make=Hasselblad),
`formatShootingInfo(tags)` and `NO_AF_MESSAGE` hooks — main.js falls back to
its generic versions when absent. Decoding `AFDebugInfo` would need several
samples with known (tap-to-focus) positions to diff.

**Unsupported cameras degrade gracefully**: no delegate is no longer fatal —
the panel still renders the embedded preview (or, for JPEGs with no embedded
PreviewImage, the file itself) plus the generic shooting-info line, with a
"<Make> is not supported yet" status. Only the overlay needs a delegate.

Not yet done / next steps:
- Calibrate `AF_POINT_SIZE_FRACTION` against real in-camera AF-frame testing
  (absolute scale only; shape confirmed). Zone mode (`AFAreaZoneSize`) unmodelled.
- Mirrored EXIF orientations (2/4/5/7) — coded, no fixture to verify.
- JPEG-path letterbox crop (see orientation caveat) + digital-TC crop test.
- Distinguish face-element types (Head/Body/Face/Eye via `FaceElementTypes`)
  instead of drawing all as one yellow box; also `FacePositions` vs the
  delegate's `FacesPositions` tag-name mismatch (latent dead branch).
- Remaining manufacturers (Canon, Nikon, Sony, …), one at a time.
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
