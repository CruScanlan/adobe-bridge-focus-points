/*
 * exiftool.js — thin wrapper around the bundled ExifTool binary.
 *
 * We never parse maker notes ourselves; ExifTool is the engine. This module
 * just spawns it and returns parsed output. Runs in the CEP panel's Node
 * context (Node.js must be enabled in manifest.xml).
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// vendor/exiftool/exiftool.exe relative to the repo root. The panel lives in
// client/, so from this file (client/lib/) the repo root is two levels up.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXIFTOOL_EXE = path.join(REPO_ROOT, 'vendor', 'exiftool', 'exiftool.exe');

/**
 * Read metadata tags from a file as a flat object of { TagName: value }.
 * Uses -json for robust parsing and -G0:1 disabled (flat names) so the
 * delegate can look tags up by their human-readable name, matching how the
 * Lr plugin's ExifUtils.findValue() addresses them.
 *
 * @param {string} file absolute path to the image
 * @param {object} [opts]
 * @param {boolean} [opts.numeric] pass -n for raw numeric values
 * @returns {object} parsed tags
 */
function readTags(file, opts = {}) {
  const args = ['-json', '-s'];           // -s: short tag names as keys
  if (opts.numeric) args.push('-n');
  args.push(file);
  const res = spawnSync(EXIFTOOL_EXE, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`exiftool exited ${res.status}: ${res.stderr || ''}`);
  }
  const parsed = JSON.parse(res.stdout);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

/**
 * Extract a binary embedded image (e.g. PreviewImage) to a temp file and
 * return its path. The Fuji FocusPixel coordinate system is the embedded
 * JPEG's pixel space, so the preview is also the natural thing to render.
 *
 * @param {string} file source image
 * @param {string} [tag] binary tag to extract (default PreviewImage)
 * @returns {string} path to the extracted JPEG in the OS temp dir
 */
function extractPreview(file, tag = 'PreviewImage') {
  const out = path.join(
    os.tmpdir(),
    `bfp-${path.basename(file, path.extname(file))}-${tag}.jpg`
  );
  const res = spawnSync(EXIFTOOL_EXE, ['-b', `-${tag}`, file], {
    maxBuffer: 256 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  if (res.status !== 0 || !res.stdout || res.stdout.length === 0) {
    throw new Error(`exiftool could not extract ${tag} from ${file}`);
  }
  fs.writeFileSync(out, res.stdout);
  return out;
}

module.exports = { readTags, extractPreview, EXIFTOOL_EXE, REPO_ROOT };
