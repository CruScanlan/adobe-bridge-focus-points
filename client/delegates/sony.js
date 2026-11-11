/*
 * sony.js — port of SonyDelegates.getAfPoints (Lua -> JS).
 *
 * Source: reference/focuspoints.lrplugin/SonyDelegates.lua (Apache-2.0,
 * © Whizzbang Inc; maintenance © Karsten Gieselmann). Ported with attribution.
 *
 * Sony specifics:
 *  - `FocusLocation` is "W H X Y": the focus position in the pixels of a
 *    W x H image (the full-size image at the aspect ratio it was shot in).
 *    That W x H is the frame we return.
 *  - `FocusFrameSize` ("WxH", newer bodies) is the size of the focus frame in
 *    the same pixels. Without it we draw the default box.
 *  - When FocusLocation is all zeros the focus point is the first focal-plane
 *    phase-detect point, given in the units of `FocalPlaneAFPointArea`.
 *  - The Lr plugin shifts the point for shots in a non-native aspect ratio,
 *    because Lightroom shows the whole sensor. We do not: the panel centres
 *    the frame on the preview, which does the same job.
 *  - The other (inactive) phase-detect points are deliberately not drawn.
 */
'use strict';

const { POINTTYPE, nums, defaultBox, shootingBasics, joinInfo } = require('./common.js');

const TAGS = [
  'FocusLocation', 'FocusFrameSize', 'FullImageSize',
  'FocalPlaneAFPointsUsed', 'FocalPlaneAFPointArea', 'FocalPlaneAFPointLocation1',
  'FacesDetected', 'Face*Position',
  'AFAreaModeSetting', 'AFTracking', 'APS-CSizeCapture',
];

function matches(tags) {
  return String(tags.Make || '').toUpperCase().indexOf('SONY') !== -1;
}

const NO_AF_MESSAGE = 'no Sony focus data recorded';

function getAfPoints(tags) {
  // Manual focus: no focus box (FocusLocation is then just the frame centre),
  // but detected faces are still drawn.
  const manual = tags.FocusMode === 'Manual';

  const loc = nums(tags.FocusLocation);           // W H X Y
  const full = nums(tags.FullImageSize);          // W H
  let frame = null;
  const points = [];

  if (manual) {
    // no focus point
  } else if (loc.length === 4 && loc[0] > 0 && loc[1] > 0) {
    frame = { width: loc[0], height: loc[1] };
    const size = nums(tags.FocusFrameSize);
    if (size.length === 2 && size[0] > 0 && size[1] > 0) {
      points.push({
        pointType: POINTTYPE.AF_FOCUS_BOX,
        x: loc[2], y: loc[3], width: size[0], height: size[1], primary: true,
      });
    } else {
      points.push(defaultBox(frame, loc[2], loc[3]));
    }
  } else if (full.length === 2 && Number(tags.FocalPlaneAFPointsUsed) > 0) {
    // FocusLocation "0 0 0 0": the first phase-detect point is the focus point.
    const area = nums(tags.FocalPlaneAFPointArea);
    const pd = nums(tags.FocalPlaneAFPointLocation1);
    if (area.length === 2 && pd.length === 2 && area[0] > 0 && area[1] > 0) {
      frame = { width: full[0], height: full[1] };
      const side = frame.width * 0.039 / 2; // the Lr plugin's phase-detect point size
      points.push({
        pointType: POINTTYPE.AF_FOCUS_BOX,
        x: pd[0] * frame.width / area[0],
        y: pd[1] * frame.height / area[1],
        width: side, height: side, primary: true,
      });
    }
  }

  // Detected faces: "top left height width" in full-size image pixels.
  const faces = parseInt(tags.FacesDetected, 10);
  if (faces > 0 && (frame || full.length === 2)) {
    if (!frame) frame = { width: full[0], height: full[1] };
    for (let i = 1; i <= faces; i++) {
      const f = nums(tags['Face' + i + 'Position']);
      if (f.length !== 4) continue;
      points.push({
        pointType: POINTTYPE.FACE,
        x: f[1] + f[3] / 2, y: f[0] + f[2] / 2, width: f[3], height: f[2],
      });
    }
  }

  if (manual) return { frame: frame || undefined, points: points, message: 'manual focus' };
  if (!points.length) return null;
  return { frame: frame, points: points };
}

/** e.g.  ILCE-7RM5 · 35mm · ƒ/8 · 1/125s · ISO 100 · AF-S · Flexible Spot · APS-C */
function formatShootingInfo(tags) {
  const parts = shootingBasics(tags);
  parts.push(tags.FocusMode);
  if (tags.FocusMode !== 'Manual') parts.push(tags.AFAreaModeSetting || tags.AFAreaMode);
  if (tags['APS-CSizeCapture'] === 'On') parts.push('APS-C');
  if (parseInt(tags.FacesDetected, 10) > 0) parts.push('Face');
  return joinInfo(parts);
}

module.exports = { matches, TAGS, getAfPoints, formatShootingInfo, NO_AF_MESSAGE };
