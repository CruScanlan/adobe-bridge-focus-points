# Bridge Focus Points

A panel for Adobe Bridge that shows where the camera focused. Select a photo
and the panel draws the autofocus point (and any detected faces or subjects)
over it, read from the metadata the camera wrote into the file.

It is the Bridge counterpart of the
[Focus-Points plugin for Lightroom Classic](https://github.com/musselwhizzle/Focus-Points),
whose focus-point geometry it ports, and it reads metadata with
[ExifTool](https://exiftool.org/).

## Supported cameras

Use files straight out of the camera (raw or JPEG). Converting to DNG or
exporting from an editor usually strips the focus data.

| Make | Bodies tested | Notes |
|---|---|---|
| Fujifilm | X-H2, X-T5, X-T4, X-T3, GFX 100S II, GFX 100S, GFX 50S II, GFX 50R | focus point, faces and subjects, in-camera crop |
| Sony | A7R V, A7R IV, A7R III, A7R II, A7 IV, A7 III, a6700, a6600, a6400 | focus point, faces. The A7 II records no focus position (faces only) |
| Nikon Z | Z8, Z7 II, Z7, Z6 III, Z6 II, Z6, Z50 II, Z50, Zfc | focus area, in-camera crop |
| Nikon DSLR | D850, D810, D800, D800E, D500, D7500 | viewfinder AF points and live view |
| Canon | R5 Mark II, R5, R, R6 Mark II, R6, R7, R10, 5D Mark IV, 5D Mark III, 6D Mark II, 7D Mark II, 90D, 80D, 77D, 70D | points in focus; if none was confirmed, the selected point is drawn dashed |
| OM System / Olympus | OM-1, OM-1 Mark II, OM-5, E-M1 Mark III, E-M1 Mark II, E-M5 Mark III | focus area, subject-detection frames |
| DJI | Air 2S and other drones | preview and flight details only: DJI records no focus position |

Other bodies from these makes generally work too; these are the ones checked
against real files. A photo taken in manual focus shows "manual focus" and no
box. Cameras from other makes show the preview and shooting details without an
overlay.

Tested with Adobe Bridge 2026 on Windows.

## Install

### Windows

1. Download `FocusPointsSetup-vX.Y.Z.exe` from the
   [latest release](https://github.com/CruScanlan/adobe-bridge-focus-points/releases/latest).
2. Run it. Windows SmartScreen will say "Windows protected your PC", because
   the installer is not signed with a paid certificate. Click **More info**,
   then **Run anyway**.
3. Restart Bridge and open **Window > Extensions > Focus Points**.

It installs for your user only (no administrator prompt) and can be removed
from Windows Settings > Apps.

### macOS

Open Terminal and run:

```
curl -fsSL https://github.com/CruScanlan/adobe-bridge-focus-points/releases/latest/download/install-mac.sh | sh
```

Then restart Bridge and open **Window > Extensions > Focus Points**. Meant for
Apple Silicon and Intel alike. Mac support is new and has not yet been
confirmed on a real Mac: please report how it goes. To remove it:

```
curl -fsSL https://github.com/CruScanlan/adobe-bridge-focus-points/releases/latest/download/install-mac.sh | sh -s -- --uninstall
```

### Manual (.zxp)

Each release also carries the `.zxp` package for use with a ZXP installer, or
unzip it into your CEP extensions folder as `com.cru.bridgefocuspoints`.

## Updates

Once a day, when the panel opens, it asks GitHub whether a newer release
exists. That request is the only network access the panel makes and it sends
nothing about you or your photos. If there is a newer version, a bar at the
top of the panel links to it.

To update, install the new version over the old one: run the new installer on
Windows, or the same Terminal command again on macOS.

## Using it

Select a photo in Bridge. The panel shows it with:

- **Focus** (green): the focus point or area. A dashed box is a point you
  selected whose focus the camera did not confirm.
- **Faces** (yellow): faces and subjects the camera detected.
- **Crop** (blue): the in-camera crop, where the camera records one.

The checkboxes at the bottom left switch each layer on and off. The line at
the bottom right shows the lens, exposure and focus mode.

## Reporting a problem

Open an [issue](https://github.com/CruScanlan/adobe-bridge-focus-points/issues)
with your camera model, what the panel showed, and if you can, a sample file
straight from the camera.

On a Mac, please also attach the diagnostics report:

```
curl -fsSL https://github.com/CruScanlan/adobe-bridge-focus-points/releases/latest/download/diagnose-mac.sh | sh
```

It writes `focuspoints-diagnostics.txt` to your Desktop (system and Bridge
versions, whether the extension is installed, recent Bridge extension logs).
Read it before attaching it.

## Development

See [CLAUDE.md](CLAUDE.md) for how the code is put together and
[docs/releasing.md](docs/releasing.md) for how releases are made.

## License

Apache License 2.0, see [LICENSE](LICENSE). Third-party components and their
licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
