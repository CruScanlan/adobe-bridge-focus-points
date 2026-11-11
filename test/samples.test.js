/*
 * Sample tests: every test/samples/*.json is a snapshot of the exiftool tags
 * from one real camera file plus the boxes its delegate is expected to draw.
 * Runs on plain Node with no Bridge, no exiftool and no raw files:
 *
 *   node --test
 *
 * Add or refresh samples with tools/add-sample.js.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { computeExpected, SAMPLES_DIR } = require('../tools/add-sample.js');

const files = fs.readdirSync(SAMPLES_DIR).filter(function (f) { return /\.json$/.test(f); });

test('there are samples to check', function () {
  assert.ok(files.length > 0);
});

files.forEach(function (file) {
  test(file, function () {
    const sample = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf8'));
    assert.deepStrictEqual(computeExpected(sample.tags), sample.expected);
  });
});
