/*
 * exiftool.js — persistent ("-stay_open") wrapper around the bundled ExifTool.
 *
 * ExifTool is a packaged Perl app; cold-starting it costs ~0.5-2s. We launch
 * ONE long-lived process for the panel's lifetime (`-stay_open True -@ -`) and
 * feed each request through its stdin, so only the very first selection pays
 * the startup cost. An image costs two cheap round-trips: one for the tags
 * (which also reports the size of every embedded image), one to pull out the
 * largest embedded image as the preview (`-json -b`, base64).
 *
 * This module knows nothing about manufacturers: the caller passes the tag
 * list (the delegate registry's union).
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

// Embedded images a file may carry. Which exist and how big they are varies by
// format (NEF/ARW/CR3 hold a full-size JpgFromRaw, RAF/CR2/ORF a big
// PreviewImage), so we ask for all of them and display the largest.
const PREVIEW_TAGS = ['JpgFromRaw', 'PreviewImage', 'OtherImage', 'ThumbnailImage'];

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

/** Run fn once every earlier request has finished (one command at a time). */
function queue(fn) {
  chain = chain.then(fn, fn); // keep the chain alive across failures
  return chain;
}

function parseOne(payload) {
  try {
    const parsed = JSON.parse(payload);
    return (Array.isArray(parsed) && parsed[0]) || {};
  } catch (e) {
    throw new Error('exiftool returned unparseable output: ' + e.message);
  }
}

/** One round-trip: the requested tags, plus which embedded image is largest. */
function inspect(file, tagList) {
  const args = ['-json', '-s'];
  tagList.concat(PREVIEW_TAGS).forEach(function (tag) { args.push('-' + tag); });
  args.push(file);
  return execute(args).then(function (payload) {
    const tags = parseOne(payload);
    let previewTag = null, best = 0;
    PREVIEW_TAGS.forEach(function (tag) {
      // Without -b a binary tag reads "(Binary data 123456 bytes, use -b ...)".
      const m = /(\d+) bytes/.exec(String(tags[tag] || ''));
      if (m && Number(m[1]) > best) { best = Number(m[1]); previewTag = tag; }
      delete tags[tag];
    });
    delete tags.SourceFile;
    return { tags: tags, previewTag: previewTag };
  });
}

/** Second round-trip: write the chosen embedded image to the temp file. */
function extractPreview(file, previewTag) {
  return execute(['-json', '-b', '-' + previewTag, file]).then(function (payload) {
    const value = parseOne(payload)[previewTag];
    if (typeof value !== 'string' || !value.length) return null;
    const b64 = value.indexOf('base64:') === 0 ? value.slice(7) : value;
    fs.writeFileSync(PREVIEW_PATH, Buffer.from(b64, 'base64'));
    return PREVIEW_PATH;
  });
}

/**
 * Read the tags and the best displayable image for a file.
 * A JPEG is displayed as itself (its embedded preview is only a thumbnail);
 * anything else shows its largest embedded image, written to a temp JPEG and
 * returned as a file:// URL (large data: URIs can destabilise CEP's CEF
 * renderer, so we avoid them).
 * @param {string} file absolute path
 * @param {string[]} tagList exiftool tag names to read
 * @returns {Promise<{tags: object, previewUrl: string|null, previewPath: string|null}>}
 */
function readFocusData(file, tagList) {
  return queue(function () {
    return inspect(file, tagList).then(function (info) {
      const done = function (previewPath) {
        return {
          tags: info.tags,
          previewPath: previewPath,
          previewUrl: previewPath ? fileUrl(previewPath) : null,
        };
      };
      if (/\.jpe?g$/i.test(file)) return done(file);
      if (!info.previewTag) return done(null);
      return extractPreview(file, info.previewTag).then(done);
    });
  });
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
