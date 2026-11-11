/*
 * fujifilm.js — port of FujifilmDelegates.getAfPoints (Lua -> JS).
 *
 * Source: reference/focuspoints.lrplugin/FujifilmDelegates.lua  (Apache-2.0,
 * © Whizzbang Inc; maintenance © 2026 Karsten Gieselmann). Ported with
 * attribution. This is pure coordinate math — no I/O, no metadata parsing
 * (ExifTool already did that). Given the tag table it returns AF boxes in the
 * frame the tags themselves describe.
 *
 * Fuji specifics (see project.md §5):
 *  - `FocusPixel` is a single (x, y) in the coordinate system of the embedded
 *    JPEG, whose size is reported by ExifImageWidth/ExifImageHeight. That is
 *    the frame returned; the panel scales it onto whatever it displays.
 *  - This reference is lost on RAF->DNG conversion, so only straight-out-of-
 *    camera RAFs (or their OOC JPEG) work. See makerNotesFound.
 */
'use strict';

const { POINTTYPE, DEFAULT_BOX_FRACTION, shootingBasics, joinInfo } = require('./common.js');

// exiftool tags this delegate reads.
const TAGS = [
  'FocusPixel', 'ExifImageWidth', 'ExifImageHeight',
  'FacesDetected', 'FacesPositions', 'FaceElementPositions', 'FaceElementTypes',
  'CropSize', 'CropTopLeft', 'RawImageAspectRatio',
  'InternalSerialNumber', 'FocusMode2', 'AFMode',
  'AFAreaPointSize', 'AFAreaZoneSize',
];

function matches(tags) {
  return String(tags.Make || '').toUpperCase().indexOf('FUJI') !== -1;
}

const NOT_OOC_MESSAGE = 'no usable maker notes (DNG/converted?) — needs OOC RAF/JPEG';

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
 * @param {object} tags  flat tag map from exiftool (-s -json keys)
 * @returns {{frame: {width:number,height:number}, points: Array}|{points: Array, message: string}|null}
 */
function getAfPoints(tags) {
  if (!makerNotesFound(tags)) return { points: [], message: NOT_OOC_MESSAGE };
  // In manual focus FocusPixel is only where the focus frame was parked.
  if (tags.FocusMode2 === 'AF-M' || tags.FocusMode === 'Manual') return { points: [], message: 'manual focus' };

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
    return { points: [], message: NOT_OOC_MESSAGE };
  }

  // Points are returned in the ExifImage* frame itself.
  const result = { frame: { width: exifW, height: exifH }, points: [] };

  // Primary point: a square box centred on the (scaled) focus pixel. We size it
  // from the camera's real Single-Point AF frame (AFAreaPointSize) when present,
  // falling back to the default fraction otherwise. The box lives in the
  // ExifImage* frame, so the side is a fraction of that frame's short side.
  const areaMode = String(tags['AFAreaMode'] || tags['AFMode'] || '');
  const ptSizeOrd = parseInt(tags['AFAreaPointSize'], 10);
  let sideFraction = DEFAULT_BOX_FRACTION;
  if (/single/i.test(areaMode) && AF_POINT_SIZE_FRACTION[ptSizeOrd] !== undefined) {
    sideFraction = AF_POINT_SIZE_FRACTION[ptSizeOrd];
  }
  const side = Math.min(exifW, exifH) * sideFraction;
  result.points.push({
    pointType: POINTTYPE.AF_FOCUS_PIXEL_BOX,
    x: x,
    y: y,
    width: side,
    height: side,
    primary: true,
  });

  // --- detected faces (FacesDetected / FacesPositions) -----------------------
  const facesDetected = tags['FacesDetected'];
  if (facesDetected !== undefined && String(facesDetected) !== '0') {
    const coords = split(tags['FacesPositions']);
    const n = parseInt(facesDetected, 10);
    if (coords) pushBoxesFromCorners(result.points, coords, n, POINTTYPE.FACE);
  }

  // --- subject detection (FaceElementPositions, exiftool >= 12.44) -----------
  const subjCoords = split(tags['FaceElementPositions']);
  if (subjCoords) {
    const n = Math.floor(subjCoords.length / 4);
    pushBoxesFromCorners(result.points, subjCoords, n, POINTTYPE.FACE);
  }

  // --- digital tele-converter crop area (CropSize/CropTopLeft, >= 12.82) -----
  const cropSize = split(tags['CropSize']);
  const cropTopLeft = split(tags['CropTopLeft']);
  if (cropSize && cropTopLeft) {
    const x1 = parseFloat(cropTopLeft[0]);
    const y1 = parseFloat(cropTopLeft[1]);
    const x2 = (parseFloat(cropSize[0]) + parseFloat(cropTopLeft[0]));
    const y2 = (parseFloat(cropSize[1]) + parseFloat(cropTopLeft[1]));
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
          x: (exifW / 2),
          y: (exifH / 2),
          width: cw,
          height: ch,
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
function pushBoxesFromCorners(out, coords, count, pointType) {
  for (let i = 0; i < count; i++) {
    const b = 4 * i;
    if (coords[b + 3] === undefined) break;
    const x1 = parseFloat(coords[b + 0]);
    const y1 = parseFloat(coords[b + 1]);
    const x2 = parseFloat(coords[b + 2]);
    const y2 = parseFloat(coords[b + 3]);
    out.push({
      pointType,
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
      width: Math.abs(x1 - x2),
      height: Math.abs(y1 - y2),
    });
  }
}

/**
 * makerNotesFound: true when the file has Fuji maker notes AND is not a DNG
 * (Fuji DNGs lose/corrupt the ExifImageWidth/Height reference). Mirrors
 * FujifilmDelegates.makerNotesFound.
 */
function makerNotesFound(tags) {
  if (tags['InternalSerialNumber'] === undefined) return false;
  if (String(tags['FileType'] || '').toUpperCase() === 'DNG') return false;
  return true;
}

function subjectLabel(tags) {
  const types = String(tags.FaceElementTypes || '');
  if (/eye/i.test(types)) return 'Eye';
  if (/face/i.test(types)) return 'Face';
  if (tags.FacesDetected && String(tags.FacesDetected) !== '0') return 'Face';
  return '';
}

/** e.g.  X-H2 · 56mm · ƒ/1.2 · 1/250s · ISO 400 · AF-C · SP 5 · Eye */
function formatShootingInfo(tags) {
  const parts = shootingBasics(tags);
  parts.push(tags.FocusMode2 || tags.AFMode || tags.FocusMode);
  // AF area + size ordinal — handy for eyeballing the camera-sized box.
  if (/single/i.test(String(tags.AFAreaMode || '')) && tags.AFAreaPointSize != null) {
    parts.push('SP ' + tags.AFAreaPointSize);
  } else {
    parts.push(tags.AFAreaMode);
  }
  parts.push(subjectLabel(tags));
  return joinInfo(parts);
}

module.exports = { matches, TAGS, getAfPoints, formatShootingInfo };
