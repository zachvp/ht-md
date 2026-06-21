#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'dist', 'chrome');

const filePath = process.argv[2];
if (!filePath) {
  console.error('[copy-static] no file path provided');
  process.exit(1);
}

const dest = path.join(OUT_DIR, filePath);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(path.join(ROOT, filePath), dest);
console.log(`[watch] copied ${filePath}`);
