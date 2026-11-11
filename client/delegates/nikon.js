/*
 * nikon.js — port of NikonDelegates.getAfPoints (Lua -> JS).
 *
 * Source: reference/focuspoints.lrplugin/NikonDelegates.lua (Apache-2.0,
 * © Whizzbang Inc; maintenance © Karsten Gieselmann). Ported with attribution.
 *
 * Nikon records focus in one of two ways:
 *  - AF area (Z bodies, and DSLRs in live view): `AFAreaXPosition/YPosition`
 *    are the centre and `AFAreaWidth/Height` the size of the focus area, in
 *    the pixels of an `AFImageWidth x AFImageHeight` image (the full,
 *    uncropped frame).
 *  - Point names (DSLR viewfinder AF): not handled here yet.
 *
 * In-camera crop (`CropHiSpeed`, e.g. "DX Crop (6064x4040 cropped to
 * 4000x2672 at pixel 1032,684)"): the embedded image is the cropped one, so
 * the area is moved into the cropped frame. See cropTransform.
 */
'use strict';

const { POINTTYPE, shootingBasics, joinInfo } = require('./common.js');

const TAGS = [
  'AFAreaXPosition', 'AFAreaYPosition', 'AFAreaWidth', 'AFAreaHeight',
  'AFImageWidth', 'AFImageHeight', 'CropHiSpeed', 'FocusDistance',
];

function matches(tags) {
  return String(tags.Make || '').toUpperCase().indexOf('NIKON') !== -1;
}

const NO_AF_MESSAGE = 'no Nikon focus data recorded';

/** "DX Crop (6064x4040 cropped to 4000x2672 at pixel 1032,684)" -> parts, or null. */
function parseCrop(cropHiSpeed) {
  const m = /^(.+) \((\d+)x(\d+) cropped to (\d+)x(\d+) at pixel (\d+),(\d+)\)/.exec(String(cropHiSpeed || ''));
  if (!m) return null;
  const crop = {
    type: m[1],
    native: { width: Number(m[2]), height: Number(m[3]) },
    cropped: { width: Number(m[4]), height: Number(m[5]) },
  };
  crop.active = !/^off|uncropped/i.test(crop.type) &&
    (crop.cropped.width !== crop.native.width || crop.cropped.height !== crop.native.height);
  return crop;
}

/**
 * Map a point from the native frame into the cropped image.
 *
 * AF coordinates describe the viewfinder image scaled to the native frame.
 * In a crop mode the finder shows the cropped area enlarged until it fills
 * the frame in its larger dimension: DX is magnified 1.5x both ways, while
 * 16:9 and 1:1 keep the scale and only lose the edges. So: scale about the
 * centre by the larger of the two crop ratios, then re-centre.
 *
 * For DX this equals the Lr plugin's transform (x * cropped / native). For
 * 16:9 and 1:1 the Lr plugin scales each axis separately, which squashes the
 * area; real files show the area keeps its size in those modes (Z6 III:
 * 163x174 uncropped, 16:9 and 1:1; 222x245 in DX), hence the difference.
 * Only centre-point crop samples exist, where both agree.
 */
function cropTransform(pt, crop) {
  const s = Math.max(crop.cropped.width / crop.native.width, crop.cropped.height / crop.native.height);
  return {
    pointType: pt.pointType,
    x: (pt.x - crop.native.width / 2) * s + crop.cropped.width / 2,
    y: (pt.y - crop.native.height / 2) * s + crop.cropped.height / 2,
    width: pt.width * s,
    height: pt.height * s,
    primary: pt.primary,
  };
}

/** The AF-area path. Returns { frame, points } or null when the tags are absent. */
function areaPoints(tags, crop) {
  const x = Number(tags.AFAreaXPosition), y = Number(tags.AFAreaYPosition);
  const w = Number(tags.AFAreaWidth), h = Number(tags.AFAreaHeight);
  if (![x, y, w, h].every(Number.isFinite) || !(w > 0) || !(h > 0)) return null;

  let frame = { width: Number(tags.AFImageWidth), height: Number(tags.AFImageHeight) };
  if (!(frame.width > 0) || !(frame.height > 0)) {
    if (!crop) return null;
    frame = crop.native;
  }
  let point = { pointType: POINTTYPE.AF_FOCUS_BOX, x: x, y: y, width: w, height: h, primary: true };
  if (crop && crop.active) {
    // AFImage* is a few pixels smaller than the CropHiSpeed native size
    // (8256 vs 8288); treat them as the same frame.
    point = cropTransform(point, { native: frame, cropped: crop.cropped });
    frame = crop.cropped;
  }
  return { frame: frame, points: [point] };
}

function getAfPoints(tags) {
  if (tags.FocusMode === 'Manual') return { points: [], message: 'manual focus' };
  const crop = parseCrop(tags.CropHiSpeed);
  return areaPoints(tags, crop);
}

/** "NIKON Z 7_2" -> "Z 7II" */
function modelName(tags) {
  return String(tags.Model || '').replace(/^NIKON\s+/i, '').replace(/_2$/, 'II').replace(/_3$/, 'III');
}

/** e.g.  Z 7II · 24mm · ƒ/11 · 1/60s · ISO 64 · AF-S · Single · DX Crop · 16.4 m */
function formatShootingInfo(tags) {
  const parts = shootingBasics(tags, modelName(tags));
  parts.push(tags.FocusMode);
  if (tags.FocusMode !== 'Manual') parts.push(tags.AFAreaMode);
  const crop = parseCrop(tags.CropHiSpeed);
  if (crop && crop.active) parts.push(crop.type);
  parts.push(tags.FocusDistance);
  return joinInfo(parts);
}

module.exports = { matches, TAGS, getAfPoints, formatShootingInfo, NO_AF_MESSAGE };
