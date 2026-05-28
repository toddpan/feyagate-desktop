#!/usr/bin/env node
// Build fota.json from a list of installer paths.
//
// Usage:
//   FEYAGATE_VERSION=1.3.0 FEYAGATE_NOTES="..." FEYAGATE_FORCE=false \
//   FEYAGATE_OTA_BASE_URL=https://your-ota.example.com/ota/feyagate-desktop \
//   node scripts/build-fota-manifest.mjs release/FeyaGate-Desktop-1.3.0-*

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const version = process.env.FEYAGATE_VERSION;
const notes = process.env.FEYAGATE_NOTES || '';
const force = process.env.FEYAGATE_FORCE === 'true';
const baseUrl = (process.env.FEYAGATE_OTA_BASE_URL || '').replace(/\/+$/, '');

if (!version || !baseUrl) {
  console.error('FEYAGATE_VERSION and FEYAGATE_OTA_BASE_URL are required');
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('no installer files given');
  process.exit(1);
}

const entries = files.map((f) => {
  const name = path.basename(f);
  const buf = fs.readFileSync(f);
  let type = 'feyagate-desktop-linux';
  if (name.includes('-mac-')) type = 'feyagate-desktop-mac';
  else if (name.includes('-win-')) type = 'feyagate-desktop-win';
  return {
    type,
    version,
    url: `${baseUrl}/${name}`,
    md5: crypto.createHash('md5').update(buf).digest('hex'),
    release_notes: notes,
    force_update: force,
    size: buf.length,
  };
});

process.stdout.write(JSON.stringify(entries, null, 2) + '\n');
