/*
 * olympus.js — OM System / Olympus: the primary-focus path of
 * OlympusDelegates.getAfPoints (Lua -> JS).
 *
 * Source: reference/focuspoints.lrplugin/OlympusDelegates.lua (Apache-2.0,
 * © Whizzbang Inc; maintenance © Karsten Gieselmann). Ported with attribution.
 * Only what yields the focus point is ported; see "not ported" below.
 *
 * Where the focus point comes from, first hit wins:
 *  1. `AFFocusArea` "left top width height" in units of `AFFrameSize`
 *     (OM System bodies: OM-1, OM-1 II, OM-5). This is the area that was
 *     actually in focus, at its real size.
 *  2. `AFPointSelected`, read numerically (`AFPointSelected#`): the point as
 *     fractions of the image width and height (Olympus bodies, and OM System
 *     when 1 is empty). Drawn as the default box.
 *  3. `AFAreas` "(x1,y1)-(x2,y2), ..." in 1/256ths of the image (older bodies).
 *
 * Subject-detect frames (`SubjectDetectArea` / `SubjectDetectDetail`, in units
 * of `SubjectDetectFrameSize`) go on the Faces layer.
 *
 * Everything is expressed in one frame: AFFrameSize when present (640x480),
 * otherwise a nominal 640x480, since the fractions carry no pixel size.
 *
 * Not ported: the selected-but-not-in-focus AF target area, and face frames
 * (`FaceDetectArea`, which needs the Lr plugin's long per-model decoding).
 */
'use strict';

const { POINTTYPE, nums, defaultBox, shootingBasics, joinInfo } = require('./common.js');

const TAGS = [
  'AFFrameSize', 'AFFocusArea', 'AFPointSelected#', 'AFAreas',
  'SubjectDetectFrameSize', 'SubjectDetectArea', 'SubjectDetectDetail',
  'AISubjectTrackingMode', 'FocusDistance', 'StackedImage',
];

function matches(tags) {
  const make = String(tags.Make || '').toUpperCase();
  return make.indexOf('OLYMPUS') !== -1 || make.indexOf('OM DIGITAL') !== -1;
}

const NO_AF_MESSAGE = 'no focus point recorded (focus not confirmed?)';

/** FocusMode reads "MF; MF" or "Single AF; S-AF, Imager AF": the first part is what was used. */
function focusMode(tags) {
  return String(tags.FocusMode || '').split(';')[0].trim();
}

function getAfPoints(tags) {
  if (focusMode(tags) === 'MF') return { points: [], message: 'manual focus' };

  const size = nums(tags.AFFrameSize);
  const frame = (size.length === 2 && size[0] > 0 && size[1] > 0)
    ? { width: size[0], height: size[1] }
    : { width: 640, height: 480 };
  const points = [];

  const area = nums(tags.AFFocusArea);           // left top width height
  const selected = nums(tags.AFPointSelected);   // x y (x y) as fractions
  if (area.length === 4 && area[2] > 0 && area[3] > 0) {
    points.push({
      pointType: POINTTYPE.AF_FOCUS_BOX,
      x: area[0] + area[2] / 2, y: area[1] + area[3] / 2,
      width: area[2], height: area[3], primary: true,
    });
  } else if (selected.length >= 2 && (selected[0] > 0 || selected[1] > 0)) {
    points.push(defaultBox(frame, selected[0] * frame.width, selected[1] * frame.height));
  } else {
    const re = /\((\d+),(\d+)\)-\((\d+),(\d+)\)/g;
    let m;
    while ((m = re.exec(String(tags.AFAreas || ''))) !== null) {
      const x1 = m[1] / 256 * frame.width, y1 = m[2] / 256 * frame.height;
      const x2 = m[3] / 256 * frame.width, y2 = m[4] / 256 * frame.height;
      if (x1 < x2 && y1 < y2) {
        points.push({
          pointType: POINTTYPE.AF_FOCUS_BOX,
          x: (x1 + x2) / 2, y: (y1 + y2) / 2, width: x2 - x1, height: y2 - y1,
        });
      }
    }
    if (points.length === 1) points[0].primary = true;
  }

  // Subject detection: whole subject, then the detail (eye, head, cockpit...).
  const sdSize = nums(tags.SubjectDetectFrameSize);
  if (sdSize.length === 2 && sdSize[0] > 0 && sdSize[1] > 0) {
    [tags.SubjectDetectArea, tags.SubjectDetectDetail].forEach(function (value) {
      const a = nums(value);
      if (a.length !== 4 || !(a[2] > 0) || !(a[3] > 0)) return;
      const sx = frame.width / sdSize[0], sy = frame.height / sdSize[1];
      points.push({
        pointType: POINTTYPE.FACE,
        x: (a[0] + a[2] / 2) * sx, y: (a[1] + a[3] / 2) * sy,
        width: a[2] * sx, height: a[3] * sy,
      });
    });
  }

  if (!points.length) return null;
  return { frame: frame, points: points };
}

/** e.g.  OM-1 · 12mm · ƒ/8 · 1/60s · ISO 200 · Single AF · 0.805 m · Focus-stacked (8 images) */
function formatShootingInfo(tags) {
  const parts = shootingBasics(tags);
  parts.push(focusMode(tags));
  parts.push(tags.FocusDistance);
  if (tags.StackedImage && !/^no$/i.test(String(tags.StackedImage))) parts.push(tags.StackedImage);
  return joinInfo(parts);
}

module.exports = { matches, TAGS, getAfPoints, formatShootingInfo, NO_AF_MESSAGE };
