# Render the embedded preview with a live SVG overlay

We show the photo's embedded preview (extracted by exiftool) in an `<img>` and draw boxes in an SVG whose `viewBox` is the preview's native pixel size, so box coordinates stay in image-pixel space at any zoom. This drops the Lr plugin's ImageMagick step, which bakes boxes into a rendered copy of the image, and means overlays re-render instantly when layers are toggled.

## Considered Options

- **ImageMagick-baked images (as in the Lr plugin)**: rejected; adds a runtime dependency and a re-render per change. ImageMagick is kept for dev-time oracle drawing only.
- **Any other rendition of the image**: the embedded preview is the image whose coordinate system Fujifilm's focus data uses (`ExifImageWidth`×`ExifImageHeight`), so on RAFs the focus point maps with a scale of exactly 1.0. Anything else adds a transform to get wrong.
