/*
 * index.js — the delegate registry.
 *
 * Adding a manufacturer is one delegate file plus one line in DELEGATES.
 * A delegate is a plain module:
 *
 *   matches(tags)            -> true if this delegate handles the file
 *   TAGS                     -> exiftool tag names it reads ('Face*Position'
 *                               style wildcards allowed for numbered tags)
 *   getAfPoints(tags)        -> { frame: {width, height}, points: [...], message? }
 *                               or null when there is nothing to draw.
 *                               `points` are centre/size boxes
 *                               ({pointType, x, y, width, height, primary?})
 *                               in the pixel space of `frame`, in the camera's
 *                               native (unrotated) orientation. `frame` is the
 *                               area the displayed preview covers. `message`
 *                               optionally says why there are no points.
 *   formatShootingInfo(tags) -> optional bottom-bar text
 *   NO_AF_MESSAGE            -> optional default status when points is empty
 *
 * Delegates are pure functions of the tag map: no I/O, no DOM, so the sample
 * tests can run them on plain Node.
 */
'use strict';

const common = require('./common.js');

// First match wins.
const DELEGATES = [
  require('./fujifilm.js'),
  require('./dji.js'),
  require('./sony.js'),
  require('./nikon.js'),
];

// Tags the panel needs whatever the camera (dispatch, orientation, info bar).
const COMMON_TAGS = [
  'Make', 'Model', 'FileType', 'Orientation',
  'LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO',
  'FocusMode', 'AFAreaMode',
];

function delegateFor(tags) {
  for (let i = 0; i < DELEGATES.length; i++) {
    if (DELEGATES[i].matches(tags)) return DELEGATES[i];
  }
  return null;
}

/** Every tag exiftool must be asked for: the common ones plus each delegate's. */
function allTags() {
  const seen = {};
  const out = [];
  [COMMON_TAGS].concat(DELEGATES.map(function (d) { return d.TAGS || []; })).forEach(function (list) {
    list.forEach(function (tag) {
      if (!seen[tag]) { seen[tag] = true; out.push(tag); }
    });
  });
  return out;
}

/** Shooting-info line for a file no delegate claims. */
function formatShootingInfo(tags) {
  return common.joinInfo(common.shootingBasics(tags).concat([tags.FocusMode, tags.AFAreaMode]));
}

module.exports = { delegateFor, allTags, formatShootingInfo };
