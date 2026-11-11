#!/usr/bin/env node
/*
 * add-sample.js — snapshot a camera file into a committed test sample.
 *
 *   node tools/add-sample.js fixtures/DSCF2714.RAF [--source <url|text>] [--note <text>]
 *   node tools/add-sample.js test/samples/DSCF2714.json     (refresh expected only)
 *
 * Given a raw/JPEG it writes test/samples/<name>.json holding the exiftool
 * tags the panel would see, plus what the delegate makes of them, and (when
 * ImageMagick is available) a check image fixtures/check/<name>.jpg with the
 * boxes drawn on the embedded preview. LOOK AT THE CHECK IMAGE before
 * committing: the expected output is only a regression baseline, nobody but
 * you has confirmed the box is in the right place.
 *
 * Given an existing sample .json it recomputes `expected` from the sample's
 * own tags (no raw needed) — for an intended geometry change, or a sample
 * whose tags were edited by hand.
 *
 * Raw files are never committed; `source` says where to get the file again
 * (tools/fetch-samples.js downloads the ones that are URLs).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SAMPLES_DIR = path.join(ROOT, 'test', 'samples');
const FIXTURES_DIR = path.join(ROOT, 'fixtures');
const CHECK_DIR = path.join(FIXTURES_DIR, 'check');
// Dev-only ImageMagick from the (gitignored) Lr plugin reference copy.
const MAGICK = process.env.MAGICK ||
  path.join(ROOT, 'reference', 'focuspoints.lrplugin', 'bin', 'ImageMagick', 'magick.exe');

const registry = require('../client/delegates/index.js');

// Tags that identify one particular camera. Samples are public; keep the key
// (delegates test for its presence) but never the value.
const REDACT = ['InternalSerialNumber', 'SerialNumber'];

const round = function (n) { return Math.round(n * 100) / 100; };

/**
 * What a sample expects: the delegate's boxes, reduced to their geometry.
 * null when no delegate handles the file or it finds no focus data at all.
 */
function computeExpected(tags) {
  const delegate = registry.delegateFor(tags);
  if (!delegate) return null;
  const result = delegate.getAfPoints(tags);
  if (!result) return null;
  const expected = {};
  if (result.frame) expected.frame = result.frame;
  if (result.message) expected.message = result.message;
  expected.points = result.points.map(function (pt) {
      const out = {
        pointType: pt.pointType,
        x: round(pt.x), y: round(pt.y),
        width: round(pt.width), height: round(pt.height),
      };
      if (pt.primary) out.primary = true;
      return out;
  });
  return expected;
}

function rotationOf(tags) {
  const m = /(\d+) CW/.exec(String(tags.Orientation || ''));
  return m ? Number(m[1]) : 0;
}

/** Draw the expected boxes on the embedded preview so a human can check them. */
function writeCheckImage(name, tags, expected, previewPath) {
  if (!fs.existsSync(MAGICK)) return 'no ImageMagick, check image skipped';
  if (!previewPath) return 'no embedded preview, check image skipped';
  const dims = execFileSync(MAGICK, ['identify', '-format', '%w %h', previewPath + '[0]'])
    .toString().trim().split(' ').map(Number);
  const frame = (expected && expected.frame) || { width: dims[0], height: dims[1] };
  const sx = dims[0] / frame.width, sy = dims[1] / frame.height;
  const colour = function (pt) {
    return pt.pointType.indexOf('face') !== -1 ? 'yellow'
      : pt.pointType.indexOf('crop') !== -1 ? 'DeepSkyBlue' : 'lime';
  };
  const args = [previewPath + '[0]', '-fill', 'none', '-strokewidth', String(Math.max(2, Math.round(dims[0] / 400)))];
  ((expected && expected.points) || []).forEach(function (pt) {
    const x1 = (pt.x - pt.width / 2) * sx, y1 = (pt.y - pt.height / 2) * sy;
    const x2 = (pt.x + pt.width / 2) * sx, y2 = (pt.y + pt.height / 2) * sy;
    args.push('-stroke', colour(pt), '-draw', 'rectangle ' + x1 + ',' + y1 + ' ' + x2 + ',' + y2);
  });
  fs.mkdirSync(CHECK_DIR, { recursive: true });
  const out = path.join(CHECK_DIR, name + '.jpg');
  // -strip: drop the preview's own Orientation tag, we have just applied it.
  args.push('-rotate', String(rotationOf(tags)), '-strip', '-resize', '1600x1600>', '-quality', '85', out);
  execFileSync(MAGICK, args);
  return 'check image: ' + path.relative(ROOT, out);
}

function writeSample(samplePath, sample) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  fs.writeFileSync(samplePath, JSON.stringify(sample, null, 2) + '\n');
}

async function snapshot(file, opts) {
  const exiftool = require('../client/lib/exiftool.js');
  const abs = path.resolve(file);
  const name = path.basename(abs, path.extname(abs)) +
    (/\.jpe?g$/i.test(abs) ? '-jpg' : ''); // an OOC JPEG sits beside its raw
  const samplePath = path.join(SAMPLES_DIR, name + '.json');
  const old = fs.existsSync(samplePath) ? JSON.parse(fs.readFileSync(samplePath, 'utf8')) : {};

  const data = await exiftool.readFocusData(abs, registry.allTags());
  const tags = data.tags;
  REDACT.forEach(function (key) { if (tags[key] !== undefined) tags[key] = '(redacted)'; });

  const sample = {
    // Path under fixtures/ where the (uncommitted) file lives.
    file: path.relative(FIXTURES_DIR, abs).replace(/\\/g, '/'),
    source: opts.source || old.source || 'unknown',
  };
  if (opts.note || old.note) sample.note = opts.note || old.note;
  sample.tags = tags;
  sample.expected = computeExpected(tags);
  writeSample(samplePath, sample);

  const n = sample.expected ? sample.expected.points.length : 0;
  console.log(path.relative(ROOT, samplePath) + ': ' + n + ' box(es)');
  console.log('  ' + writeCheckImage(name, tags, sample.expected, data.previewPath));
}

function refresh(samplePath) {
  const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  sample.expected = computeExpected(sample.tags);
  writeSample(samplePath, sample);
  console.log(path.relative(ROOT, samplePath) + ': expected refreshed from its tags');
}

async function main(argv) {
  const opts = {}, files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') opts.source = argv[++i];
    else if (argv[i] === '--note') opts.note = argv[++i];
    else files.push(argv[i]);
  }
  if (!files.length) {
    console.error('usage: node tools/add-sample.js <raw-or-sample.json>... [--source <url|text>] [--note <text>]');
    process.exit(2);
  }
  try {
    for (const file of files) {
      if (/\.json$/i.test(file)) refresh(path.resolve(file));
      else await snapshot(file, opts);
    }
  } finally {
    try { require('../client/lib/exiftool.js').stop(); } catch (e) { /* never started */ }
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(function (err) { console.error(err.message || err); process.exit(1); });
}

module.exports = { computeExpected, SAMPLES_DIR, FIXTURES_DIR };
