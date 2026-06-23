/*
 * exiftool.js — persistent ("-stay_open") wrapper around the bundled ExifTool.
 *
 * ExifTool is a packaged Perl app; cold-starting it costs ~0.5-2s. We launch
 * ONE long-lived process for the panel's lifetime (`-stay_open True -@ -`) and
 * feed each request through its stdin, so only the very first selection pays
 * the startup cost. Each request fetches the AF tags AND the embedded preview
 * in a single `-execute` (via `-json -b`, which returns the preview as a
 * base64 string), so there is one round-trip per image.
 *
 * Runs in the CEP panel's Node context (Node enabled in manifest.xml).
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// vendor/exiftool/exiftool.exe relative to this file (client/lib/ -> repo root).
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXIFTOOL_EXE = path.join(REPO_ROOT, 'vendor', 'exiftool', 'exiftool.exe');

// Only the tags the Fuji delegate + panel actually use. Keeping this tight
// means ExifTool parses/serialises less per call.
const TAGS = [
  'FocusPixel', 'ExifImageWidth', 'ExifImageHeight',
  'Make', 'Model', 'Orientation',
  'FacesDetected', 'FacesPositions', 'FaceElementPositions', 'FaceElementTypes',
  'CropSize', 'CropTopLeft', 'RawImageAspectRatio',
  'InternalSerialNumber', 'FocusMode', 'FocusMode2', 'AFMode',
  'AFAreaMode', 'AFAreaPointSize', 'AFAreaZoneSize',
  // Shooting-info readout (bottom bar).
  'LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO',
];

let proc = null;          // the long-lived exiftool process
let stdoutBuf = '';       // accumulates stdout until the {ready<n>} marker
let pending = null;       // the in-flight request: { marker, resolve, reject }
let seq = 0;              // -execute sequence number
let chain = Promise.resolve(); // serialises requests onto the single process

function ensureProc() {
  if (proc) return;
  proc = spawn(EXIFTOOL_EXE, ['-stay_open', 'True', '-@', '-'], { windowsHide: true });
  proc.stdout.setEncoding('utf8'); // JSON + base64 are ASCII; handles boundaries
  proc.stdout.on('data', onData);
  proc.stderr.on('data', function () { /* exiftool warnings — ignore */ });
  proc.on('error', failPending);
  proc.on('exit', function () {
    proc = null;
    failPending(new Error('exiftool process exited'));
  });
}

function failPending(err) {
  if (pending) { var p = pending; pending = null; stdoutBuf = ''; p.reject(err); }
}

function onData(chunk) {
  if (!pending) return; // stray output between commands
  stdoutBuf += chunk;
  const idx = stdoutBuf.indexOf(pending.marker);
  if (idx === -1) return;
  const payload = stdoutBuf.slice(0, idx);
  stdoutBuf = '';                       // marker consumed; reset for next request
  const p = pending; pending = null;
  p.resolve(payload);
}

/** Issue one request to the persistent process and resolve with raw stdout. */
function execute(args) {
  return new Promise(function (resolve, reject) {
    ensureProc();
    seq += 1;
    const n = seq;
    pending = { marker: '{ready' + n + '}', resolve: resolve, reject: reject };
    const lines = args.concat(['-execute' + n]).join('\n') + '\n';
    proc.stdin.write(lines);
  });
}

// Single reused temp file for the extracted preview (avoids unbounded temp
// growth; a ?t= cache-buster on the URL stops the browser reusing a stale one).
const PREVIEW_PATH = path.join(os.tmpdir(), 'bfp-preview.jpg');

/** Build a file:// URL the <img> can load from a Windows/abs path. */
function fileUrl(p) {
  let u = p.replace(/\\/g, '/');
  if (u.charAt(0) !== '/') u = '/' + u;
  return 'file://' + encodeURI(u) + '?t=' + Date.now();
}

/**
 * Read AF tags + embedded preview for a file in a single exiftool round-trip.
 * The preview is written to a temp JPEG and returned as a file:// URL (large
 * data: URIs can destabilise CEP's CEF renderer, so we avoid them).
 * @param {string} file absolute path
 * @returns {Promise<{tags: object, previewUrl: string|null}>}
 */
function readFocusData(file) {
  // Serialise: only one command may be in flight on the shared process.
  const run = function () {
    const args = ['-json', '-s', '-b'];
    for (let i = 0; i < TAGS.length; i++) args.push('-' + TAGS[i]);
    args.push('-PreviewImage', file);
    return execute(args).then(function (payload) {
      let tags = {};
      try {
        const parsed = JSON.parse(payload);
        if (Array.isArray(parsed) && parsed[0]) tags = parsed[0];
      } catch (e) {
        throw new Error('exiftool returned unparseable output: ' + e.message);
      }
      let previewUrl = null;
      const pv = tags.PreviewImage;
      if (typeof pv === 'string' && pv.length) {
        const b64 = pv.indexOf('base64:') === 0 ? pv.slice(7) : pv;
        fs.writeFileSync(PREVIEW_PATH, Buffer.from(b64, 'base64'));
        previewUrl = fileUrl(PREVIEW_PATH);
      }
      delete tags.PreviewImage;
      return { tags: tags, previewUrl: previewUrl };
    });
  };
  chain = chain.then(run, run); // keep the chain alive across failures
  return chain;
}

/** Shut the persistent process down (call on panel unload). */
function stop() {
  if (!proc) return;
  try { proc.stdin.write('-stay_open\nFalse\n'); } catch (e) { /* ignore */ }
  try { proc.stdin.end(); } catch (e) { /* ignore */ }
  proc = null;
  pending = null;
  stdoutBuf = '';
}

module.exports = { readFocusData, stop, EXIFTOOL_EXE, REPO_ROOT };
