#!/usr/bin/env node
/*
 * fetch-samples.js — download the raw files behind the committed samples.
 *
 *   node tools/fetch-samples.js [name-filter]
 *
 * Raw files are never committed. Each test/samples/*.json records where its
 * file came from (`source`) and where it lives under fixtures/ (`file`); this
 * fetches every one whose source is a URL and that is not already on disk.
 * Samples marked "Cru's own" (or any non-URL source) are skipped.
 *
 * The tests do not need these files. They are for looking at a sample in
 * Bridge, or re-snapshotting it with tools/add-sample.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const SAMPLES_DIR = path.join(ROOT, 'test', 'samples');
const FIXTURES_DIR = path.join(ROOT, 'fixtures');

function download(url, dest, redirects) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (redirects || 0) < 5) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).href, dest, (redirects || 0) + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const part = dest + '.part';
      const out = fs.createWriteStream(part);
      res.pipe(out);
      out.on('finish', function () { out.close(function () { fs.renameSync(part, dest); resolve(); }); });
      out.on('error', reject);
    }).on('error', reject);
  });
}

async function main(filter) {
  const samples = fs.readdirSync(SAMPLES_DIR).filter(function (f) {
    return /\.json$/.test(f) && (!filter || f.indexOf(filter) !== -1);
  });
  let fetched = 0, failed = 0;
  for (const name of samples) {
    const sample = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, name), 'utf8'));
    if (!/^https:\/\//.test(sample.source || '') || !sample.file) continue;
    const dest = path.join(FIXTURES_DIR, sample.file);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    process.stdout.write(sample.file + ' ... ');
    try {
      await download(encodeURI(sample.source), dest);
      fetched++;
      console.log((fs.statSync(dest).size / 1e6).toFixed(1) + ' MB');
    } catch (err) {
      failed++;
      console.log('FAILED (' + err.message + ')');
    }
  }
  console.log(fetched + ' downloaded, ' + failed + ' failed');
  if (failed) process.exit(1);
}

main(process.argv[2]);
