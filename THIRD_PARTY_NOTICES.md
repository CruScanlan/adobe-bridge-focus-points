# Third-party notices

Bridge Focus Points is licensed under the Apache License 2.0 (see `LICENSE`).
It includes or derives from the following third-party work.

## Focus-Points plugin for Lightroom Classic

<https://github.com/musselwhizzle/Focus-Points>

Original work © Whizzbang Inc. Ongoing maintenance and modifications
© Karsten Gieselmann. Licensed under the Apache License, Version 2.0; the
full text is in `LICENSE`.

The per-manufacturer focus-point geometry in this extension was ported from
that plugin (Lua to JavaScript) and modified:

| File here | Ported from |
|---|---|
| `client/delegates/fujifilm.js` | `FujifilmDelegates.lua` |
| `client/delegates/sony.js` | `SonyDelegates.lua` |
| `client/delegates/nikon.js` | `NikonDelegates.lua` |
| `client/delegates/canon.js` | `CanonDelegates.lua` |
| `client/delegates/olympus.js` | `OlympusDelegates.lua` |
| `client/delegates/common.js` | `DefaultDelegates.lua`, `DefaultPointRenderer.lua` (point types, default box size) |
| `client/delegates/nikon-points.js` | the AF point maps in `focus_points/nikon corporation/*.txt` (data, converted to JavaScript) |

Each ported file says so in its header. The changes from the originals are
the translation itself, the removal of everything specific to Lightroom, and
the deviations described in those headers.

## ExifTool

<https://exiftool.org/> — Copyright © 2003-2026 Phil Harvey.

Shipped unmodified in `vendor/exiftool/` (the official Windows package,
version 13.55). ExifTool is free software; it may be redistributed and/or
modified under the same terms as Perl itself (the GNU General Public License
or the Artistic License). See `vendor/exiftool/exiftool_files/LICENSE` and
`vendor/exiftool/exiftool_files/readme_windows.txt`.

The Windows package also contains the Strawberry Perl runtime that ExifTool
runs on. Its licenses are in
`vendor/exiftool/exiftool_files/Licenses_Strawberry_Perl.zip`.

This extension only runs ExifTool as a separate program; it does not link to
it.

## CSInterface.js

`client/lib/CSInterface.js` — Copyright 2020 Adobe Systems Incorporated.
Adobe's CEP 12 interface library, from
<https://github.com/Adobe-CEP/CEP-Resources>, unmodified, used under the
terms in its header.
