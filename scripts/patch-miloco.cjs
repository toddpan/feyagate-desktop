/**
 * patch-miloco.cjs
 *
 * electron-builder afterPack hook for mac-arm64 (CommonJS - package.json has "type":"module").
 *
 * Patches miloco-mcp-server in the just-packed .app to add the missing Homebrew dylibs
 * (yaml-cpp 0.9, ffmpeg libavcodec/avutil/swscale/swresample) and their transitive deps
 * (libvpx, dav1d, lame, opus, svt-av1, x264, x265, openssl), then re-codesigns everything.
 *
 * Without this, miloco crashes at startup with:
 *   dyld: Library not loaded: @executable_path/lib/libyaml-cpp.0.9.dylib
 *
 * Why? miloco v1.2.17 mac-arm64 release ships without these libs (upstream bug — the
 * mac-x64 release has them). We patch it locally using brew as the source.
 *
 * Exports: default async (context) => void
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BREW_PREFIX = '/opt/homebrew';

function brewCellar(formula) {
  try {
    return execFileSync('brew', ['--cellar', formula], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function latestVersionDir(cellar) {
  if (!cellar || !fs.existsSync(cellar)) return null;
  const versions = fs.readdirSync(cellar).filter((v) => fs.statSync(path.join(cellar, v)).isDirectory());
  if (versions.length === 0) return null;
  // simple numeric-ish sort (handles "8.1.2_1" and "8.1.2")
  versions.sort((a, b) => {
    const na = a.split(/[._]/).map((s) => parseInt(s, 10) || 0);
    const nb = b.split(/[._]/).map((s) => parseInt(s, 10) || 0);
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const x = na[i] || 0;
      const y = nb[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  });
  return path.join(cellar, versions[versions.length - 1]);
}

function installNameTool(args) {
  try {
    execFileSync('install_name_tool', args, { stdio: 'pipe' });
  } catch (err) {
    const msg = (err.stderr && err.stderr.toString()) || err.message || '';
    // Ignore "duplicate path" warnings — installer is idempotent
    if (!msg.includes('duplicate')) {
      console.warn(`[patch-miloco] install_name_tool ${args.join(' ')}: ${msg.trim()}`);
    }
  }
}

function codesign(file) {
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', file], { stdio: 'pipe' });
  } catch (err) {
    console.warn(`[patch-miloco] codesign failed for ${file}: ${err.message}`);
  }
}

module.exports = async function patchMiloco(context) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    console.log('[patch-miloco] skip: not macOS arm64');
    return;
  }

  const APP_PATH = (context && (context.appOutDir || context.outDir)) || context;
  if (!APP_PATH || typeof APP_PATH !== 'string') {
    console.warn('[patch-miloco] no app path in context');
    return;
  }

  // context.appOutDir is the directory containing the .app (e.g. .../release/mac-arm64)
  // the .app bundle lives at <appOutDir>/<productName>.app
  const CONTEXT_BASE = path.basename(APP_PATH);
  const APP_BUNDLE = CONTEXT_BASE.endsWith('.app') ? APP_PATH : path.join(APP_PATH, 'FeyaGate Desktop.app');

  const SERVER = path.join(APP_BUNDLE, 'Contents', 'Resources', 'server');
  const SERVER_LIB = path.join(SERVER, 'lib');
  const MILOCO = path.join(SERVER, 'miloco-mcp-server');

  if (!fs.existsSync(MILOCO)) {
    console.warn(`[patch-miloco] miloco not found at ${MILOCO}`);
    return;
  }

  if (!fs.existsSync(BREW_PREFIX)) {
    console.warn('[patch-miloco] /opt/homebrew not found, skipping dylib patch');
    return;
  }

  const ffmpegCellar = brewCellar('ffmpeg');
  const yamlCellar = brewCellar('yaml-cpp');
  if (!ffmpegCellar || !yamlCellar) {
    console.warn('[patch-miloco] ffmpeg or yaml-cpp not installed via brew, skipping');
    return;
  }

  const ffmpegLib = path.join(latestVersionDir(ffmpegCellar), 'lib');
  const yamlLib = path.join(latestVersionDir(yamlCellar), 'lib');
  if (!fs.existsSync(ffmpegLib) || !fs.existsSync(yamlLib)) {
    console.warn('[patch-miloco] brew lib dir missing, skipping');
    return;
  }

  // miloco 1.2.20 起链接 libmosquitto (华为消息中心 MQTT —— 华为设备的唯一写通道),
  // 而 spdlog / fmt / openssl@3 一直只有绝对 brew 路径、从未随包收进来。
  // 缺任何一个, 没装过对应 brew 公式的机器上 dyld 会直接拒绝启动。
  // 这里把 miloco 的直接 brew 依赖里「尚未单独处理」的那些一并收进 app 的 server/lib,
  // 名字从 otool -L 读, 不写死版本号 (brew 升级不会让钩子失效)。
  const INLINE_LIBS = new Set([
    'libavcodec.62.dylib',
    'libavutil.60.dylib',
    'libswscale.9.dylib',
    'libswresample.6.dylib',
    'libyaml-cpp.0.9.dylib',
  ]);
  const brewDeps = [];
  try {
    const depsOut = execFileSync('otool', ['-L', MILOCO], { encoding: 'utf8' });
    for (const line of depsOut.split('\n').slice(1)) {
      const abs = line.trim().split(' ')[0];
      if (abs && abs.startsWith(`${BREW_PREFIX}/`) && fs.existsSync(abs)) {
        brewDeps.push({ name: path.basename(abs), path: abs });
      }
    }
  } catch (err) {
    console.warn(`[patch-miloco] otool -L failed: ${err.message}`);
  }
  const extraDylibs = brewDeps.filter((d) => !INLINE_LIBS.has(d.name));
  if (extraDylibs.length > 0) {
    console.log(`[patch-miloco] bundling extra brew deps: ${extraDylibs.map((d) => d.name).join(', ')}`);
  }

  fs.mkdirSync(SERVER_LIB, { recursive: true });

  console.log('[patch-miloco] copying missing dylibs from brew...');
  const copies = [
    ['libavcodec.62.dylib', ffmpegLib],
    ['libavutil.60.dylib', ffmpegLib],
    ['libswscale.9.dylib', ffmpegLib],
    ['libswresample.6.dylib', ffmpegLib],
    ['libyaml-cpp.0.9.dylib', yamlLib],
  ];
  for (const [name, src] of copies) {
    const from = path.join(src, name);
    const to = path.join(SERVER_LIB, name);
    if (!fs.existsSync(from)) {
      console.warn(`[patch-miloco] source missing: ${from}`);
      continue;
    }
    fs.copyFileSync(from, to);
  }
  for (const { name, path: from } of extraDylibs) {
    fs.copyFileSync(from, path.join(SERVER_LIB, name));
  }

  console.log('[patch-miloco] rewriting install_name / rpath...');

  // dylib IDs so they find each other via @loader_path
  for (const name of [...INLINE_LIBS, ...extraDylibs.map((d) => d.name)]) {
    installNameTool(['-id', `@loader_path/${name}`, path.join(SERVER_LIB, name)]);
  }

  installNameTool([
    '-change', path.join(ffmpegLib, 'libswresample.6.dylib'), '@loader_path/libswresample.6.dylib',
    '-change', path.join(ffmpegLib, 'libavutil.60.dylib'), '@loader_path/libavutil.60.dylib',
    path.join(SERVER_LIB, 'libavcodec.62.dylib'),
  ]);
  installNameTool([
    '-change', path.join(ffmpegLib, 'libavutil.60.dylib'), '@loader_path/libavutil.60.dylib',
    path.join(SERVER_LIB, 'libswscale.9.dylib'),
  ]);

  // 已收进 server/lib 的直接 brew 依赖, 在 miloco 里统一指向包内 lib/。
  // 注意对「可执行文件」而言 @loader_path 是它自己所在目录 (server/), 不是 lib/,
  // 所以必须写 @executable_path/lib/ —— 写成 @loader_path/ 会让 app 直接起不来。
  // 引用可能是绝对 brew 路径, 也可能是上一次已改写过的 @loader_path/ (幂等处理)。
  const bundledLibs = new Set(fs.readdirSync(SERVER_LIB));
  let milocoDeps = '';
  try {
    milocoDeps = execFileSync('otool', ['-L', MILOCO], { encoding: 'utf8' });
  } catch (err) {
    console.warn(`[patch-miloco] otool -L (executable) failed: ${err.message}`);
  }
  for (const line of milocoDeps.split('\n').slice(1)) {
    const ref = line.trim().split(' ')[0];
    if (!ref || ref === MILOCO) continue;
    if (!ref.startsWith(`${BREW_PREFIX}/`) && !ref.startsWith('@loader_path/')) continue;
    const base = path.basename(ref);
    if (bundledLibs.has(base)) {
      installNameTool(['-change', ref, `@executable_path/lib/${base}`, MILOCO]);
    }
  }

  // 这些库彼此之间的绝对 brew 引用 (例: libmosquitto -> openssl@3) 同样收敛到 @loader_path,
  // 只重写已经在 server/lib 里存在的那些。
  for (const { name } of extraDylibs) {
    const self = path.join(SERVER_LIB, name);
    let selfDeps = '';
    try {
      selfDeps = execFileSync('otool', ['-L', self], { encoding: 'utf8' });
    } catch {
      continue;
    }
    for (const line of selfDeps.split('\n').slice(1)) {
      const abs = line.trim().split(' ')[0];
      if (!abs || !abs.startsWith(`${BREW_PREFIX}/`)) continue;
      const base = path.basename(abs);
      if (fs.existsSync(path.join(SERVER_LIB, base))) {
        installNameTool(['-change', abs, `@loader_path/${base}`, self]);
      }
    }
  }

  // miloco rpath
  const rpaths = [
    '@executable_path/lib',
    ffmpegLib,
    path.join(BREW_PREFIX, 'opt/libvpx/lib'),
    path.join(BREW_PREFIX, 'opt/dav1d/lib'),
    path.join(BREW_PREFIX, 'opt/lame/lib'),
    path.join(BREW_PREFIX, 'opt/opus/lib'),
    path.join(BREW_PREFIX, 'opt/svt-av1/lib'),
    path.join(BREW_PREFIX, 'opt/x264/lib'),
    path.join(BREW_PREFIX, 'opt/x265/lib'),
    path.join(BREW_PREFIX, 'opt/openssl@3/lib'),
  ];
  for (const rp of rpaths) {
    installNameTool(['-add_rpath', rp, MILOCO]);
  }

  console.log('[patch-miloco] re-signing miloco + dylibs (ad-hoc)...');
  codesign(MILOCO);
  for (const f of fs.readdirSync(SERVER_LIB)) {
    if (f.endsWith('.dylib')) codesign(path.join(SERVER_LIB, f));
  }

  console.log('[patch-miloco] OK');
};