# Delegate metadata to exiftool; port geometry from the Focus-Points Lr plugin

Reading where a camera focused means decoding manufacturer-specific, per-body maker notes, which is the genuinely hard part of this project and already solved twice. We bundle the complete Windows exiftool (shelled out, never reimplemented) for all extraction, and port the per-manufacturer geometry that turns exiftool tags into pixel coordinates from the Focus-Points Lightroom plugin (Lua → JS, Apache 2.0, with attribution), one manufacturer at a time.

## Considered Options

- **Write our own maker-note parser**: rejected; decades of reverse-engineering we would be redoing badly.
- **Port from digiKam**: kept as a cross-reference only. It extracts through Exiv2, not exiftool, so its extraction layer does not transfer; its geometry is a second opinion where the Lr code is thin.

## Consequences

The bundled exiftool version is a floor on what we can show (subject detection needs ≥ 12.44, tele-converter crop ≥ 12.82). A misplaced box is almost always a transform bug in our port, not a parse bug.
