/*
 * dji.js — DJI delegate.
 *
 * Unlike Fuji there is NO prior art to port: neither the Focus-Points Lr
 * plugin nor digiKam supports DJI, and exiftool's DJI module decodes no
 * AF-point tags — the only focus-related output is `AFDebugInfo`, an opaque
 * 256-byte binary blob nobody has reverse-engineered (see fixtures/DJI_0685.DNG
 * for a sample). So this delegate deliberately draws nothing: it exists to
 * make DJI files first-class in the panel (preview + shooting/flight info,
 * honest "no AF data" status) instead of "not supported yet".
 *
 * If the AFDebugInfo blob is ever decoded (needs multiple samples with known
 * tap-to-focus positions to diff), getAfPoints is where the box would go.
 */
'use strict';

// Camera model codes as reported in EXIF Make/Model. DJI writes internal
// codes (FC****); map the ones we can name to something readable. Unknown
// codes fall through to the raw code, which is still identifiable.
const MODEL_NAMES = {
  'FC3411': 'DJI Air 2S',
  'FC3170': 'DJI Mavic Air 2',
  'FC7303': 'DJI Mini 2',
  'FC3582': 'DJI Mini 3 Pro',
  'FC8482': 'DJI Mini 4 Pro',
  'FC6310': 'DJI Phantom 4 Pro',
  'L1D-20C': 'DJI Mavic 2 Pro',
  'L2D-20C': 'DJI Mavic 3',
};

/** Does this tag set belong to a DJI camera? (Mavic 2/3 report Make=Hasselblad
 *  with an L?D-20c model code, so Make alone is not enough.) */
function matches(tags) {
  const make = String(tags.Make || '').toUpperCase();
  const model = String(tags.Model || '').toUpperCase();
  if (make.indexOf('DJI') !== -1) return true;
  return make.indexOf('HASSELBLAD') !== -1 && /^L\dD-/.test(model);
}

function modelName(tags) {
  const code = String(tags.Model || '').toUpperCase();
  return MODEL_NAMES[code] || (tags.Model ? 'DJI ' + tags.Model : 'DJI');
}

/**
 * DJI records no decoded AF-point coordinates in any known metadata, so there
 * is never a box to draw. Returning an empty point list (not null) lets the
 * panel render the preview + info bar and report the absence honestly.
 */
function getAfPoints(/* tags, display */) {
  return { points: [], scale: null, noAfData: true };
}

// Status-line text for the empty result — more honest than the generic
// "no focus point recorded", which implies other DJI files might have one.
const NO_AF_MESSAGE = 'DJI does not record AF-point coordinates';

/**
 * Drone-flavoured bottom-bar readout. Focal length is shown as 35mm-equivalent
 * (the physical 8.4mm of a 1" sensor means little), plus height above the
 * launch point and gimbal pitch — the drone equivalents of "how it was shot".
 * e.g.  DJI Air 2S · 22mm eq · ƒ/2.8 · 1/200s · ISO 100 · +144m AGL · gimbal −13°
 */
function formatShootingInfo(tags) {
  const parts = [modelName(tags)];
  const eq = String(tags.FocalLengthIn35mmFormat || '').replace(/\s*mm$/i, '');
  if (eq) parts.push(eq + 'mm eq');
  else if (tags.FocalLength) parts.push(String(tags.FocalLength).replace(/\s*mm$/i, '') + 'mm');
  if (tags.FNumber != null && tags.FNumber !== '') parts.push('ƒ/' + tags.FNumber);
  if (tags.ExposureTime != null && tags.ExposureTime !== '') parts.push(tags.ExposureTime + 's');
  if (tags.ISO != null && tags.ISO !== '') parts.push('ISO ' + tags.ISO);
  const agl = parseFloat(tags.RelativeAltitude);
  if (Number.isFinite(agl)) parts.push((agl >= 0 ? '+' : '') + agl.toFixed(0) + 'm AGL');
  const pitch = parseFloat(tags.GimbalPitchDegree);
  if (Number.isFinite(pitch)) parts.push('gimbal ' + (pitch > 0 ? '+' : '') + pitch.toFixed(0) + '°');
  return parts.join('  ·  ');
}

/** All DJI aircraft/handhelds get the same (point-less) treatment. */
function modelSupported(/* model */) {
  return true;
}

/** DNG *is* DJI's straight-out-of-camera raw format — always acceptable. */
function makerNotesFound(tags /*, filePath */) {
  return matches(tags);
}

/** No focus-mode metadata is decoded either; never claim manual focus. */
function manualFocusUsed(/* tags */) {
  return false;
}

module.exports = {
  matches,
  getAfPoints,
  modelSupported,
  makerNotesFound,
  manualFocusUsed,
  formatShootingInfo,
  NO_AF_MESSAGE,
};
