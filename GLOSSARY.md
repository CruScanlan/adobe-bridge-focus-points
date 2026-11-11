# Bridge Focus Points

An Adobe Bridge panel that shows where the camera focused on the selected photo, by reading the camera's own metadata and marking the focus point(s) over a preview of the image.

## Source material

**Maker notes**:
The manufacturer-specific, largely undocumented block of camera metadata where focus information lives. We read it through exiftool; we never decode it ourselves.
_Avoid_: EXIF (too broad), metadata (too vague)

**Tag**:
A single named metadata value as exiftool reports it (e.g. `FocusPixel`, `ExifImageWidth`).
_Avoid_: field, property, attribute

**OOC file**:
A straight-out-of-camera file (an original RAF or the camera's own JPEG), untouched by any converter. Only OOC files carry reliable focus data; a conversion such as RAF→DNG can strip or corrupt it.
_Avoid_: original, raw (a DNG is also raw but is not OOC)

**Fixture**:
A real camera file kept in the repo as test input, paired where possible with an **oracle**.

**Oracle**:
A reference rendering that shows where the AF box *should* land on a fixture; the ground truth a change is checked against.
_Avoid_: expected output, golden image

## Geometry

**Focus point**:
The place in the frame where the camera's autofocus locked, as the camera recorded it.
_Avoid_: AF spot, focus location, focus area (an **AF area** is something else)

**AF area**:
The camera setting that governed how focus was chosen: single point, zone, wide/tracking, plus the point size within it.
_Avoid_: focus mode (that is AF-S / AF-C / MF)

**Native frame**:
The image as the sensor captured it, before any orientation is applied. All focus coordinates are expressed in the native frame.
_Avoid_: raw orientation, unrotated image

**Image-pixel space**:
Coordinates measured in pixels of the native-frame preview, independent of how large it is drawn on screen.
_Avoid_: screen coordinates, display space

**Orientation**:
The rotation (and possible mirroring) the camera says should be applied to the native frame for it to look upright.
_Avoid_: rotation (only one part of it)

**Embedded preview**:
The JPEG the camera stores inside a RAW file (full-size on Fujifilm, small on DJI). It is what the panel shows, and for Fujifilm it shares the coordinate system the focus point is recorded in.
_Avoid_: thumbnail (a smaller, different image), Bridge preview

## What gets drawn

**Overlay**:
Everything drawn on top of the embedded preview for one photo.

**AF box**:
The square marker drawn on the overlay for a focus point. Its size reflects the camera's AF point size when that is known.
_Avoid_: focus box, focus rectangle, marker

**Face box**:
A box for a face or detected subject (eye, head, body, animal, vehicle…) the camera reported.
_Avoid_: subject box, detection box

**Crop box**:
A dashed box showing the part of the frame the camera actually kept, when that is less than the full sensor.

**Aspect-ratio crop**:
A crop that comes from shooting in a non-native aspect ratio (e.g. 16:9 on a 3:2 sensor); centred, trimming two edges.

**Tele-converter crop**:
A crop from the camera's digital tele-converter: a smaller, centred region of the frame at a recorded size and position. Takes precedence over an aspect-ratio crop.
_Avoid_: digital zoom

**Layer**:
One independently toggleable group of the overlay: **Focus**, **Faces** or **Crop**. A layer with nothing to show for the current photo is unavailable rather than empty.

**Shooting info**:
The one-line summary of how the photo was taken (body, focal length, aperture, shutter, ISO, focus mode, AF area, detected subject; altitude and gimbal for drones).
_Avoid_: EXIF info, metadata line

## Camera support

**Delegate**:
The manufacturer-specific translator that turns a photo's tags into boxes and shooting info. One per manufacturer, named after the term in the Focus-Points Lightroom plugin it is ported from.
_Avoid_: driver, handler, parser (a delegate never parses maker notes)

**Supported camera**:
A camera whose manufacturer has a delegate. An **unsupported camera** still gets its preview and generic shooting info, just no overlay.

**No-AF camera**:
A supported camera that records no focus position at all (currently DJI drones). Its delegate deliberately draws nothing and says so.
_Avoid_: broken, missing data
