#!/usr/bin/env node
/**
 * Download the matching MCP server binary for the current platform/arch
 * into resources/server/. Reads version + URL from package.json.
 *
 * Usage:
 *   node scripts/download-server.js                      # use pkg.feyagate.serverVersion
 *   node scripts/download-server.js --version 1.2.16     # override
 *   FEYAGATE_SERVER_URL=https://my-mirror node scripts/download-server.js
 *
 * Environment:
 *   FEYAGATE_SERVER_URL   override the release base URL
 *   FEYAGATE_SKIP_FETCH   set to "1" to skip (useful in CI / forks)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(PROJECT_ROOT, 'resources', 'server');

if (process.env.FEYAGATE_SKIP_FETCH === '1') {
  console.log('[download-server] FEYAGATE_SKIP_FETCH=1 — skipping');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
const cfg = pkg.feyagate || {};
const argv = parseArgs(process.argv.slice(2));

const version = argv.version || cfg.serverVersion;
const baseUrl = process.env.FEYAGATE_SERVER_URL || cfg.serverRelease;

if (!version || !baseUrl) {
  console.error('[download-server] package.json must define feyagate.serverVersion and feyagate.serverRelease');
  process.exit(1);
}

const platformTag = detectPlatform();
const archive = `miloco-mcp-server-${platformTag}-v${version}.zip`;
const url = `${baseUrl}/v${version}/${archive}`;
const checksumUrl = `${baseUrl}/v${version}/${archive}.sha256`;

console.log(`[download-server] platform=${platformTag} version=${version}`);
console.log(`[download-server] from ${url}`);

await main();

async function main() {
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  // Skip if the binary is already present and the cached version matches.
  const stamp = path.join(TARGET_DIR, '.version');
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf-8').trim() === version) {
    const bin = path.join(TARGET_DIR, binaryName());
    if (fs.existsSync(bin)) {
      console.log(`[download-server] already on v${version}; skipping`);
      return;
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feyagate-server-'));
  const zipPath = path.join(tmpDir, archive);

  try {
    await download(url, zipPath);
    const expected = await fetchText(checksumUrl).catch(() => null);
    if (expected) {
      const actual = sha256(zipPath);
      const want = expected.trim().split(/\s+/)[0].toLowerCase();
      if (actual !== want) {
        throw new Error(`checksum mismatch (got ${actual}, want ${want})`);
      }
      console.log(`[download-server] sha256 ok`);
    } else {
      console.warn('[download-server] no .sha256 published; skipping integrity check');
    }

    cleanTarget(TARGET_DIR);
    unzip(zipPath, TARGET_DIR);

    const bin = path.join(TARGET_DIR, binaryName());
    if (!fs.existsSync(bin)) {
      throw new Error(`extracted archive does not contain ${binaryName()}`);
    }
    if (process.platform !== 'win32') {
      fs.chmodSync(bin, 0o755);
    }

    fs.writeFileSync(stamp, version + '\n');
    console.log(`[download-server] installed v${version} -> ${TARGET_DIR}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function detectPlatform() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin' && a === 'arm64') return 'mac-arm64';
  if (p === 'darwin' && a === 'x64') return 'mac-x64';
  if (p === 'win32' && a === 'x64') return 'win-x64';
  if (p === 'linux' && a === 'x64') return 'linux-x64';
  if (p === 'linux' && a === 'arm64') return 'linux-arm64';
  throw new Error(`unsupported platform/arch: ${p}/${a}`);
}

function binaryName() {
  return process.platform === 'win32' ? 'miloco-mcp-server.exe' : 'miloco-mcp-server';
}

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version') out.version = args[++i];
  }
  return out;
}

function download(u, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(u, { headers: { 'User-Agent': 'feyagate-desktop-installer' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.rmSync(dest, { force: true });
        resolve(download(res.headers.location, dest));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', reject);
  });
}

function fetchText(u) {
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'feyagate-desktop-installer' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        resolve(fetchText(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve(buf));
    }).on('error', reject);
  });
}

function sha256(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

function cleanTarget(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (entry === '.gitkeep' || entry === 'README.md') continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function unzip(zip, dest) {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zip}' -DestinationPath '${dest}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -oq "${zip}" -d "${dest}"`, { stdio: 'inherit' });
  }
}
