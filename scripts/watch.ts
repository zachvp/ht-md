#!/usr/bin/env tsx
/*
Dev watch script for Brave/Chrome or Firefox.
Runs an initial build (no packaging), then keeps esbuild and web-ext
running in parallel while watching static assets inline via chokidar.

Usage:
  npm run watch             # Chrome (default)
  npm run watch -- --firefox  # Firefox

Requires:
  CHROMIUM_BINARY  env var for Chrome target
  FIREFOX_BINARY   env var for Firefox target
*/
import chokidar from 'chokidar';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const useFirefox = process.argv.includes('--firefox');
const TARGET = useFirefox ? 'firefox' : 'chrome';
const OUT_DIR = path.join(ROOT, 'dist', TARGET);

if (useFirefox) {
  const FIREFOX_BINARY = process.env.FIREFOX_BINARY;
  if (!FIREFOX_BINARY) {
    console.error('[watch] FIREFOX_BINARY is not set');
    process.exit(1);
  }
} else {
  const CHROMIUM_BINARY = process.env.CHROMIUM_BINARY;
  if (!CHROMIUM_BINARY) {
    console.error('[watch] CHROMIUM_BINARY is not set');
    process.exit(1);
  }
}

execSync(`tsx scripts/build.ts ${TARGET} --no-pack`, { cwd: ROOT, stdio: 'inherit' });

chokidar.watch(['content.css', 'options.html', 'icons/**'], { cwd: ROOT }).on('change', (filePath) => {
  const dest = path.join(OUT_DIR, filePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, filePath), dest);
  console.log(`[static] copied ${filePath}`);
});

const esbuild = spawn(
  'npx', ['esbuild', 'src/*.ts', '--bundle', '--platform=browser', `--outdir=${OUT_DIR}`, '--watch'],
  { cwd: ROOT, stdio: 'inherit', shell: true },
);

const webextArgs = useFirefox
  ? ['web-ext', 'run', '--target', 'firefox', '--firefox', process.env.FIREFOX_BINARY!, '--source-dir', OUT_DIR]
  : ['web-ext', 'run', '--target', 'chromium', '--chromium-binary', process.env.CHROMIUM_BINARY!, '--source-dir', OUT_DIR];

const webext = spawn('npx', webextArgs, { cwd: ROOT, stdio: 'inherit' });

function shutdown() {
  esbuild.kill();
  webext.kill();
  process.exit(0);
}

esbuild.on('exit', shutdown);
webext.on('exit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
