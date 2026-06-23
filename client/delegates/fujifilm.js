/*
 * fujifilm.js — port of FujifilmDelegates.getAfPoints (Lua -> JS).
 *
 * Source: reference/focuspoints.lrplugin/FujifilmDelegates.lua  (Apache-2.0,
 * © Whizzbang Inc; maintenance © 2026 Karsten Gieselmann). Ported with
 * attribution. This is pure coordinate math — no I/O, no metadata parsing
 * (ExifTool already did that). Given the tag table and the dimensions of the
 * image we are going to display, it returns AF boxes in *display* pixels.
 *
 * Fuji specifics (see project.md §5):
 *  - `FocusPixel` is a single (x, y) in the coordinate system of the embedded
 *    JPEG, whose size is reported by ExifImageWidth/ExifImageHeight.
 *  - The transform is a pure scale from that system to the displayed image:
 *      xScale = displayW / ExifImageWidth,  yScale = displayH / ExifImageHeight
 *  - This reference is lost on RAF->DNG conversion, so callers must feed
 *    straight-out-of-camera RAFs (or their OOC JPEG). See modelSupported/
 *    makerNotesFound for the DNG guard.
 */
'use strict';

// Point-type vocabulary, mirrors DefaultDelegates.lua.
const POINTTYPE = {
  AF_FOCUS_PIXEL: 'af_focus_pixel',         // small box around the focus pixel
  AF_FOCUS_PIXEL_BOX: 'af_focus_pixel_box', // medium/large box with centre dot
  FACE: 'face',                             // detected face / subject box
  CROP: 'crop',                             // digital tele-converter crop area
};

// Box-size scaling factors, mirrors FocusPointPrefs.focusBoxSize { 0, .04, .1 }.
// Default is medium, as in the Lr plugin (initfocusBoxSize = medium). Used as a
// fallback when the camera's real AF-frame size is unavailable.
const FOCUS_BOX_SIZE = { small: 0, medium: 0.04, large: 0.1 };

// Real in-camera AF-frame size (approximation). Fuji records only an ordinal,
// `AFAreaPointSize` 1..7 for Single Point — NOT a pixel size — and neither the
// Lr nor digiKam ports use it at all. We map that ordinal to a fraction of the
// frame's short side. These numbers are empirical and meant to be TUNED against
// real shots: each step is +2% of the short side, spanning a small pinpoint to
// a large single-point frame. The fixtures span sizes 3/5/6, so they give a
// relative sanity check (size 3 must look clearly smaller than size 6).
// AFAreaZoneSize (Zone mode) is a separate scale and not modelled yet.
const AF_POINT_SIZE_FRACTION = {
  1: 0.04, 2: 0.06, 3: 0.08, 4: 0.10, 5: 0.12, 6: 0.14, 7: 0.16,
};

/** Split a space-separated tag value into trimmed string parts. */
function split(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim().split(/\s+/);
}

/** Parse a "W:H" ratio (e.g. "16:9") into { w, h }, or null if not valid. */
function split2(value) {
  if (value === undefined || value === null) return null;
  const m = String(value).match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const w = parseFloat(m[1]), h = parseFloat(m[2]);
  if (!(w > 0) || !(h > 0)) return null;
  return { w, h };
}

/**
 * Compute AF visualisation boxes for a Fuji file.
 *
 * @param {object} tags      flat tag map from exiftool (-s -json keys)
 * @param {object} display   { width, height } of the image being rendered.
 *                           For the v1 slice this is the embedded preview's
 *                           size (== ExifImageWidth/Height, so scale == 1).
 * @param {object} [opts]
 * @param {number} [opts.boxSize=FOCUS_BOX_SIZE.medium]
 * @returns {{points: Array, scale: {x:number,y:number}, focusPixel: {x:number,y:number}}|null}
 */
function getAfPoints(tags, display, opts = {}) {
  const boxSize = opts.boxSize !== undefined ? opts.boxSize : FOCUS_BOX_SIZE.medium;

  // --- primary focus point ---------------------------------------------------
  const focusPixel = tags['FocusPixel'];
  if (focusPixel === undefined || focusPixel === null) {
    // No focus pixel tag -> nothing to draw (e.g. manual focus / unsupported).
    return null;
  }
  const fp = split(focusPixel);
  const x = parseFloat(fp[0]);
  const y = parseFloat(fp[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  // ExifImageWidth/Height define the coordinate system FocusPixel lives in.
  // Their absence (or a DNG) means there is nothing to anchor the scale to.
  const exifW = parseFloat(tags['ExifImageWidth']);
  const exifH = parseFloat(tags['ExifImageHeight']);
  if (!Number.isFinite(exifW) || !Number.isFinite(exifH)) {
    // Caller should have already rejected non-OOC sources; signal the miss.
    return { points: [], scale: null, focusPixel: { x, y }, notOoc: true };
  }

  const xScale = display.width / exifW;
  const yScale = display.height / exifH;

  const result = {
    focusPixel: { x, y },
    scale: { x: xScale, y: yScale },
    points: [],
  };

  // Primary point: a square box centred on the (scaled) focus pixel. We size it
  // from the camera's real Single-Point AF frame (AFAreaPointSize) when present,
  // falling back to the fixed boxSize fraction otherwise. The box lives in the
  // ExifImage* frame, so the side is a fraction of that frame's short side.
  const areaMode = String(tags['AFAreaMode'] || tags['AFMode'] || '');
  const ptSizeOrd = parseInt(tags['AFAreaPointSize'], 10);
  let sideFraction = boxSize;
  let cameraSized = false;
  if (/single/i.test(areaMode) && AF_POINT_SIZE_FRACTION[ptSizeOrd] !== undefined) {
    sideFraction = AF_POINT_SIZE_FRACTION[ptSizeOrd];
    cameraSized = true;
  }
  const side = Math.min(display.width, display.height) * sideFraction;
  result.points.push({
    pointType: sideFraction === FOCUS_BOX_SIZE.small
      ? POINTTYPE.AF_FOCUS_PIXEL
      : POINTTYPE.AF_FOCUS_PIXEL_BOX,
    x: x * xScale,
    y: y * yScale,
    width: side,
    height: side,
    primary: true,
    cameraSized: cameraSized,
    afAreaPointSize: Number.isFinite(ptSizeOrd) ? ptSizeOrd : null,
  });

  // --- detected faces (FacesDetected / FacesPositions) -----------------------
  const facesDetected = tags['FacesDetected'];
  if (facesDetected !== undefined && String(facesDetected) !== '0') {
    const coords = split(tags['FacesPositions']);
    const n = parseInt(facesDetected, 10);
    if (coords) pushBoxesFromCorners(result.points, coords, n, xScale, yScale, POINTTYPE.FACE);
  }

  // --- subject detection (FaceElementPositions, exiftool >= 12.44) -----------
  const subjCoords = split(tags['FaceElementPositions']);
  if (subjCoords) {
    const n = Math.floor(subjCoords.length / 4);
    pushBoxesFromCorners(result.points, subjCoords, n, xScale, yScale, POINTTYPE.FACE);
  }

  // --- digital tele-converter crop area (CropSize/CropTopLeft, >= 12.82) -----
  const cropSize = split(tags['CropSize']);
  const cropTopLeft = split(tags['CropTopLeft']);
  if (cropSize && cropTopLeft) {
    const x1 = parseFloat(cropTopLeft[0]) * xScale;
    const y1 = parseFloat(cropTopLeft[1]) * yScale;
    const x2 = (parseFloat(cropSize[0]) + parseFloat(cropTopLeft[0])) * xScale;
    const y2 = (parseFloat(cropSize[1]) + parseFloat(cropTopLeft[1])) * yScale;
    result.points.push({
      pointType: POINTTYPE.CROP,
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
      width: Math.abs(x1 - x2),
      height: Math.abs(y1 - y2),
    });
  } else {
    // --- in-camera aspect-ratio crop (RawImageAspectRatio, e.g. "16:9", "1:1")
    // A centred crop of the full (ExifImage*) frame: the preview is the whole
    // sensor, so we draw the intended framing rather than physically cropping.
    // Skipped when it matches the frame's own aspect (a normal 3:2 shot).
    const ar = split2(tags['RawImageAspectRatio']);
    if (ar) {
      const targetR = ar.w / ar.h;
      const frameR = exifW / exifH;
      if (Math.abs(targetR - frameR) > 0.01) {
        let cw, ch;
        if (targetR > frameR) { cw = exifW; ch = exifW / targetR; } // trim top/bottom
        else { ch = exifH; cw = exifH * targetR; }                  // trim sides
        result.points.push({
          pointType: POINTTYPE.CROP,
          x: (exifW / 2) * xScale,
          y: (exifH / 2) * yScale,
          width: cw * xScale,
          height: ch * yScale,
        });
      }
    }
  }

  return result;
}

/**
 * Push centre/size boxes built from flat [x1 y1 x2 y2, ...] corner quads.
 * Mirrors the face/subject loops in the Lua delegate.
 */
function pushBoxesFromCorners(out, coords, count, xScale, yScale, pointType) {
  for (let i = 0; i < count; i++) {
    const b = 4 * i;
    if (coords[b + 3] === undefined) break;
    const x1 = parseFloat(coords[b + 0]) * xScale;
    const y1 = parseFloat(coords[b + 1]) * yScale;
    const x2 = parseFloat(coords[b + 2]) * xScale;
    const y2 = parseFloat(coords[b + 3]) * yScale;
    out.push({
      pointType,
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
      width: Math.abs(x1 - x2),
      height: Math.abs(y1 - y2),
    });
  }
}

/** modelSupported: Fuji delegate supports the entire X/GFX line. */
function modelSupported(/* model */) {
  return true;
}

/**
 * makerNotesFound: true when the file has Fuji maker notes AND is not a DNG
 * (Fuji DNGs lose/corrupt the ExifImageWidth/Height reference). Mirrors
 * FujifilmDelegates.makerNotesFound.
 */
function makerNotesFound(tags, filePath) {
  if (tags['InternalSerialNumber'] === undefined) return false;
  if (filePath && /\.dng$/i.test(filePath)) return false;
  return true;
}

/** manualFocusUsed: no focus point to draw if manual focus was used. */
function manualFocusUsed(tags) {
  const mode = tags['FocusMode2'] || tags['FocusMode'];
  return mode === 'Manual' || mode === 'AF-M';
}

module.exports = {
  getAfPoints,
  modelSupported,
  makerNotesFound,
  manualFocusUsed,
  POINTTYPE,
  FOCUS_BOX_SIZE,
};
