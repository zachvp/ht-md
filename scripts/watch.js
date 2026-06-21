#!/usr/bin/env node
// Live-reload dev server for Brave/Chrome.
// Runs an initial chrome build, then watches src/ and static assets for
// changes, and keeps web-ext running so the extension auto-reloads.
//
// Usage: npm run watch

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg  = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const OUT_DIR = path.join(ROOT, 'dist', 'chrome');
const BRAVE_BINARY = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

const STATIC_FILES = ['content.css', 'turndown.js', 'options.html'];

function copyStatic(file) {
  if (file === 'content.css') {
    const css = fs.readFileSync(path.join(ROOT, file), 'utf8')
      .replace(/\{\{EXT_NAME\}\}/g, pkg.name);
    fs.writeFileSync(path.join(OUT_DIR, file), css);
  } else {
    fs.copyFileSync(path.join(ROOT, file), path.join(OUT_DIR, file));
  }
}

function copyStatics() {
  for (const file of STATIC_FILES) copyStatic(file);
  fs.cpSync(path.join(ROOT, 'icons'), path.join(OUT_DIR, 'icons'), { recursive: true });
}

function writeManifest() {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.base.json'), 'utf8'));
  const overrideRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.chrome.json'), 'utf8'));
  const override = Object.fromEntries(
    Object.entries(overrideRaw).filter(([k]) => !k.startsWith('_'))
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ ...base, name: pkg.name, ...override }, null, 2) + '\n'
  );
}

// Initial build
console.log('[watch] initial build...');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
execSync(
  `npx esbuild src/background.ts src/content.ts src/options.ts --bundle --platform=browser --outdir=${JSON.stringify(OUT_DIR)}`,
  { cwd: ROOT, stdio: 'inherit' }
);
copyStatics();
writeManifest();
console.log('[watch] ready\n');

// Watch static files and re-copy on change
for (const file of STATIC_FILES) {
  fs.watch(path.join(ROOT, file), () => {
    console.log(`[watch] ${file} changed`);
    copyStatic(file);
  });
}

// esbuild in watch mode — rebuilds TS on every save
const esbuild = spawn(
  'npx',
  [
    'esbuild',
    'src/background.ts', 'src/content.ts', 'src/options.ts',
    '--bundle', '--platform=browser',
    `--outdir=${OUT_DIR}`,
    '--watch',
  ],
  { cwd: ROOT, stdio: 'inherit' }
);

// web-ext watching dist/chrome/ and reloading the extension in Brave
const webext = spawn(
  'npx',
  [
    'web-ext', 'run',
    '--target', 'chromium',
    '--chromium-binary', BRAVE_BINARY,
    '--source-dir', OUT_DIR,
  ],
  { cwd: ROOT, stdio: 'inherit' }
);

function shutdown() {
  esbuild.kill();
  webext.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
