# DJI is supported but deliberately draws no focus overlay

DJI files record no decodable focus position: neither the Lr plugin nor digiKam supports DJI, exiftool decodes no DJI AF tags, and the only focus-related data (`AFDebugInfo`, a 256-byte undecoded blob) showed no position-like field across three Air 2S samples. Rather than guess, the DJI delegate shows the preview, drone shooting info and an explicit "DJI does not record AF-point coordinates" status. Revisit only with paired samples where focus was tapped at known, opposite positions, so the blob can be diffed.
