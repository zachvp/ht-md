#!/usr/bin/env tsx
/*
Dev watch script for Brave/Chrome.
Runs an initial chrome build (no packaging), then keeps esbuild and web-ext
running in parallel while watching static assets inline via chokidar.

Usage: npm run watch
Requires: CHROMIUM_BINARY env var pointing to a Chromium-based browser binary.
*/
import chokidar from 'chokidar';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'dist', 'chrome');
const CHROMIUM_BINARY = process.env.CHROMIUM_BINARY;

if (!CHROMIUM_BINARY) {
  console.error('[watch] CHROMIUM_BINARY is not set');
  process.exit(1);
}

execSync('tsx scripts/build.ts chrome --no-pack', { cwd: ROOT, stdio: 'inherit' });

chokidar.watch(['content.css', 'turndown.js', 'options.html', 'icons/**'], { cwd: ROOT }).on('change', (filePath) => {
  const dest = path.join(OUT_DIR, filePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, filePath), dest);
  console.log(`[static] copied ${filePath}`);
});

const esbuild = spawn(
  'npx', ['esbuild', 'src/*.ts', '--bundle', '--platform=browser', `--outdir=${OUT_DIR}`, '--watch'],
  { cwd: ROOT, stdio: 'inherit', shell: true },
);

const webext = spawn(
  'npx', ['web-ext', 'run', '--target', 'chromium', '--chromium-binary', CHROMIUM_BINARY, '--source-dir', OUT_DIR],
  { cwd: ROOT, stdio: 'inherit' },
);

function shutdown() {
  esbuild.kill();
  webext.kill();
  process.exit(0);
}

esbuild.on('exit', shutdown);
webext.on('exit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
