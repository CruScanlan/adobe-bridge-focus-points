# Handle orientation by rotating the image+overlay together, not the points

Focus coordinates are in the camera's native frame. The Lr plugin rotates each point because it bakes pixels; we instead leave all points in native space and apply one CSS transform to the image and overlay as a unit, with `image-orientation: none` so CEF never auto-rotates the preview itself. Delegates therefore stay orientation-agnostic: do not add rotation logic to a delegate.

## Consequences

`image-orientation: none` is load-bearing: a RAF's embedded preview carries its own Orientation tag but an OOC JPEG's does not, so letting CEF rotate would treat the two inconsistently.
