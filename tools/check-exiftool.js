#!/usr/bin/env node
/*
 * check-exiftool.js — run the real exiftool over sample raws and compare with
 * the committed snapshots.
 *
 *   node tools/check-exiftool.js [name-filter]
 *
 * `node --test` never touches exiftool: the samples hold tags extracted
 * earlier. This is the other half. For every sample whose raw file is on disk
 * (get them with tools/fetch-samples.js) it reads the tags through
 * client/lib/exiftool.js, exactly as the panel does, and checks that both the
 * tags and the delegate's boxes match the sample. On macOS that exercises the
 * Perl route; on Windows the .exe, or the Perl route too with BFP_PERL set to
 * a perl binary. Exits 1 on any difference, or if no raw was found.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { computeExpected, SAMPLES_DIR, FIXTURES_DIR } = require('./add-sample.js');
const registry = require('../client/delegates/index.js');
const exiftool = require('../client/lib/exiftool.js');

const REDACT = ['InternalSerialNumber', 'SerialNumber'];

async function main(filter) {
  let checked = 0, failed = 0;
  const names = fs.readdirSync(SAMPLES_DIR).filter(function (f) {
    return /\.json$/.test(f) && (!filter || f.indexOf(filter) !== -1);
  });
  for (const name of names) {
    const sample = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, name), 'utf8'));
    const raw = sample.file && path.join(FIXTURES_DIR, sample.file);
    if (!raw || !fs.existsSync(raw) || /-edited\.json$/.test(name)) continue;
    checked++;
    try {
      const data = await exiftool.readFocusData(raw, registry.allTags());
      REDACT.forEach(function (key) { if (data.tags[key] !== undefined) data.tags[key] = '(redacted)'; });
      // Older snapshots predate tags that later delegates asked for, so only
      // the tags a snapshot holds are compared.
      const seen = {};
      Object.keys(sample.tags).forEach(function (key) { seen[key] = data.tags[key]; });
      assert.deepStrictEqual(seen, sample.tags, 'tags differ');
      assert.deepStrictEqual(computeExpected(data.tags), sample.expected, 'boxes differ');
      if (!/\.jpe?g$/i.test(raw)) assert.ok(data.previewPath && fs.statSync(data.previewPath).size > 0, 'no preview extracted');
      console.log('ok    ' + name);
    } catch (err) {
      failed++;
      console.log('FAIL  ' + name + ': ' + String(err.message).split('\n').slice(0, 12).join('\n      '));
    }
  }
  exiftool.stop();
  console.log(checked + ' checked, ' + failed + ' failed');
  if (failed || !checked) process.exit(1);
}

main(process.argv[2]).catch(function (err) { console.error(err.message || err); process.exit(1); });
