/*
 * canon.js — port of CanonDelegates.getAfPoints (Lua -> JS).
 *
 * Source: reference/focuspoints.lrplugin/CanonDelegates.lua (Apache-2.0,
 * © Whizzbang Inc; maintenance © Karsten Gieselmann). Ported with attribution.
 *
 * Canon specifics:
 *  - Every AF area the camera has is listed: `AFAreaXPositions`/`YPositions`
 *    (centres) and `AFAreaWidths`/`Heights`, in the pixels of an
 *    `AFImageWidth x AFImageHeight` image. That image is the frame.
 *  - Positions are measured from the frame CENTRE with Y pointing UP
 *    (compacts: Y down), so they are converted to top-left-origin here.
 *  - `AFPointsInFocus` lists the indices (0-based) of the areas that were in
 *    focus. Only those are drawn; the rest of the grid, and the points that
 *    were selected but not in focus, are deliberately left out.
 *  - Older bodies give one `AFAreaWidth`/`AFAreaHeight` for all areas.
 */
'use strict';

const { POINTTYPE, nums, shootingBasics, joinInfo } = require('./common.js');

const TAGS = [
  'AFImageWidth', 'AFImageHeight', 'CanonImageWidth', 'CanonImageHeight',
  'ExifImageWidth', 'ExifImageHeight',
  'AFAreaWidth', 'AFAreaHeight', 'AFAreaWidths', 'AFAreaHeights',
  'AFAreaXPositions', 'AFAreaYPositions', 'AFPointsInFocus', 'CameraType',
];

function matches(tags) {
  return String(tags.Make || '').toUpperCase().indexOf('CANON') !== -1;
}

const NO_AF_MESSAGE = 'no AF point in focus recorded';

function manualFocus(tags) {
  return /^Manual Focus/i.test(String(tags.FocusMode || ''));
}

function getAfPoints(tags) {
  if (manualFocus(tags)) return { points: [], message: 'manual focus' };

  // The original EOS 5D reports a wrong AF image size; use the Canon one.
  const is5D = /^Canon EOS 5D$/i.test(String(tags.Model || ''));
  const width = Number((is5D ? tags.CanonImageWidth : tags.AFImageWidth) || tags.ExifImageWidth);
  const height = Number((is5D ? tags.CanonImageHeight : tags.AFImageHeight) || tags.ExifImageHeight);
  if (!(width > 0) || !(height > 0)) return null;

  const xs = nums(tags.AFAreaXPositions), ys = nums(tags.AFAreaYPositions);
  const widths = nums(tags.AFAreaWidths), heights = nums(tags.AFAreaHeights);
  const oneWidth = Number(tags.AFAreaWidth), oneHeight = Number(tags.AFAreaHeight);
  if (!xs.length || xs.length !== ys.length) return null;

  const yDirection = /compact/i.test(String(tags.CameraType || '')) ? 1 : -1;
  const frame = { width: width, height: height };
  const points = [];
  nums(tags.AFPointsInFocus).forEach(function (i) {
    if (i < 0 || i >= xs.length) return;
    const w = widths[i] !== undefined ? widths[i] : oneWidth;
    const h = heights[i] !== undefined ? heights[i] : oneHeight;
    if (!(w > 0) || !(h > 0)) return;
    points.push({
      pointType: POINTTYPE.AF_FOCUS_BOX,
      x: width / 2 + xs[i],
      y: height / 2 + ys[i] * yDirection,
      width: w,
      height: h,
    });
  });
  if (points.length === 1) points[0].primary = true;
  return { frame: frame, points: points };
}

/** "Canon EOS R5m2" -> "EOS R5 Mark II" */
function modelName(tags) {
  return String(tags.Model || '').replace(/^Canon\s+/i, '').replace(/m(\d)$/, function (_, n) {
    return ' Mark ' + ['', 'I', 'II', 'III', 'IV'][Number(n)];
  });
}

/** e.g.  EOS R5 · 50mm · ƒ/8 · 1/100s · ISO 100 · One-shot AF · Spot AF */
function formatShootingInfo(tags) {
  const parts = shootingBasics(tags, modelName(tags));
  if (manualFocus(tags)) parts.push('Manual focus');
  else parts.push(tags.FocusMode, tags.AFAreaMode);
  return joinInfo(parts);
}

module.exports = { matches, TAGS, getAfPoints, formatShootingInfo, NO_AF_MESSAGE };
