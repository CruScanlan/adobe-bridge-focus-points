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
// Default is medium, as in the Lr plugin (initfocusBoxSize = medium).
const FOCUS_BOX_SIZE = { small: 0, medium: 0.04, large: 0.1 };

/** Split a space-separated tag value into trimmed string parts. */
function split(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim().split(/\s+/);
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

  // Primary point: a square box centred on the (scaled) focus pixel.
  // Mirrors DefaultPointRenderer.createFocusFrame() with no explicit w/h:
  //   w = min(cropW, cropH) * focusBoxSize ; h = w. (no crop here -> display dims)
  const side = Math.min(display.width, display.height) * boxSize;
  result.points.push({
    pointType: boxSize === FOCUS_BOX_SIZE.small
      ? POINTTYPE.AF_FOCUS_PIXEL
      : POINTTYPE.AF_FOCUS_PIXEL_BOX,
    x: x * xScale,
    y: y * yScale,
    width: side,
    height: side,
    primary: true,
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
