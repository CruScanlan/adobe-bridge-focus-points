/*
 * common.js — small helpers shared by the delegates and the panel.
 *
 * The point-type vocabulary and the default box size mirror
 * DefaultDelegates.lua / FocusPointPrefs.lua of the Focus-Points Lr plugin
 * (Apache-2.0, © Whizzbang Inc; maintenance © Karsten Gieselmann).
 */
'use strict';

// A point's type decides its layer and colour: anything containing "face"
// goes on the Faces layer, "crop" on the Crop layer, the rest on Focus.
const POINTTYPE = {
  AF_FOCUS_PIXEL_BOX: 'af_focus_pixel_box', // default-sized box round a focus pixel
  AF_FOCUS_BOX: 'af_focus_box',             // box whose size the camera recorded
  AF_SELECTED: 'af_selected',               // point the photographer chose; focus not confirmed (dashed)
  FACE: 'face',                             // detected face / subject
  CROP: 'crop',                             // in-camera crop area
};

// Side of the default focus box as a fraction of the frame's short side
// (the Lr plugin's "medium"). Used when the camera records no frame size.
const DEFAULT_BOX_FRACTION = 0.04;

/** All numbers in a tag value: "640 428 320 214" or "6000x4000" -> [..]. */
function nums(value) {
  if (value === undefined || value === null) return [];
  const m = String(value).match(/-?\d+(?:\.\d+)?/g);
  return m ? m.map(Number) : [];
}

/** A default-sized square focus box centred on (x, y) in the given frame. */
function defaultBox(frame, x, y) {
  const side = Math.min(frame.width, frame.height) * DEFAULT_BOX_FRACTION;
  return { pointType: POINTTYPE.AF_FOCUS_PIXEL_BOX, x: x, y: y, width: side, height: side, primary: true };
}

/** The camera-independent start of the shooting-info line, as a parts list. */
function shootingBasics(tags, modelName) {
  const parts = [];
  if (modelName || tags.Model) parts.push(modelName || tags.Model);
  // A lens with no electronic contacts reports 0 mm and ƒ/0: leave those out.
  if (parseFloat(tags.FocalLength) > 0) {
    parts.push(String(tags.FocalLength).replace(/\s*mm$/i, '').replace(/\.0$/, '') + 'mm');
  }
  if (parseFloat(tags.FNumber) > 0) parts.push('ƒ/' + tags.FNumber);
  if (tags.ExposureTime != null && tags.ExposureTime !== '') parts.push(tags.ExposureTime + 's');
  if (tags.ISO != null && tags.ISO !== '') parts.push('ISO ' + tags.ISO);
  return parts;
}

/** Join shooting-info parts, dropping empty ones. */
function joinInfo(parts) {
  return parts.filter(function (p) { return p !== undefined && p !== null && p !== ''; }).join('  ·  ');
}

module.exports = { POINTTYPE, DEFAULT_BOX_FRACTION, nums, defaultBox, shootingBasics, joinInfo };
