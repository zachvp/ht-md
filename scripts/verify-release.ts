#!/usr/bin/env tsx
/*
Downloads release zip archives from GitHub and verifies:
  1. Structure — expected files are present, no unexpected extras
  2. Integrity — sha256 matches the locally-built dist/checksums.txt

Usage:
  npm run verify:release -- <version-tag>
  tsx scripts/verify-release.ts 2026.6.23.0
*/

import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = new Set([
  'manifest.json',
  'background.js',
  'content.js',
  'options.js',
  'content.css',
  'options.css',
  'options.html',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
]);

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function checkStructure(zipPath: string): boolean {
  const name = path.basename(zipPath);
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries()
    .map(e => e.entryName)
    .filter(e => !e.endsWith('/'));

  const present = new Set(entries);
  const missing = [...REQUIRED_FILES].filter(f => !present.has(f));
  const extra = entries.filter(f => !REQUIRED_FILES.has(f));

  let ok = true;
  if (missing.length > 0) {
    console.log(`  FAIL [structure] ${name}: missing files: ${missing.join(', ')}`);
    ok = false;
  }
  if (extra.length > 0) {
    console.log(`  FAIL [structure] ${name}: unexpected files: ${extra.join(', ')}`);
    ok = false;
  }
  if (ok) {
    console.log(`  PASS [structure] ${name}`);
  }
  return ok;
}

function checkIntegrity(zipPath: string, expected: Map<string, string>): boolean {
  const name = path.basename(zipPath);
  const actual = sha256(zipPath);
  const expectedHash = expected.get(name);

  if (!expectedHash) {
    console.log(`  SKIP [integrity] ${name}: not found in checksums.txt`);
    return true;
  }
  if (actual === expectedHash) {
    console.log(`  PASS [integrity] ${name}`);
    return true;
  }
  console.log(`  FAIL [integrity] ${name}`);
  console.log(`    expected: ${expectedHash}`);
  console.log(`    actual:   ${actual}`);
  return false;
}

function loadChecksums(checksumPath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(checksumPath)) return map;
  for (const line of fs.readFileSync(checksumPath, 'utf8').trim().split('\n')) {
    const [hash, name] = line.trim().split(/\s+/);
    if (hash && name) map.set(name, hash);
  }
  return map;
}

function main(): void {
  const args = process.argv.slice(2);
  const localMode = args[0] === '--local';

  if (!localMode && !args[0]) {
    console.error('Usage:');
    console.error('  tsx scripts/verify-release.ts <version-tag>');
    console.error('  tsx scripts/verify-release.ts --local <zip> [zip2...]');
    process.exit(1);
  }

  let zips: string[];

  if (localMode) {
    zips = args.slice(1).map(p => path.resolve(p));
    const missing = zips.filter(p => !fs.existsSync(p));
    if (missing.length > 0) {
      console.error(`File(s) not found: ${missing.join(', ')}`);
      process.exit(1);
    }
    console.log(`Verifying local files: ${zips.map(p => path.basename(p)).join(', ')}`);
  } else {
    const tag = args[0];
    const tempDir = path.join(os.tmpdir(), `ht-md-verify-${tag}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`Downloading release assets for ${tag} -> ${tempDir}`);
    try {
      execSync(`gh release download ${tag} --dir ${JSON.stringify(tempDir)} --pattern "*.zip"`, {
        cwd: ROOT,
        stdio: 'inherit',
      });
    } catch {
      console.error('Failed to download release assets. Is `gh` authenticated and the tag correct?');
      process.exit(1);
    }

    zips = fs.readdirSync(tempDir)
      .filter(f => f.endsWith('.zip'))
      .map(f => path.join(tempDir, f));

    if (zips.length === 0) {
      console.error('No zip files found in release.');
      process.exit(1);
    }
  }

  const checksums = loadChecksums(path.join(ROOT, 'dist', 'checksums.txt'));
  if (checksums.size === 0) {
    console.warn('Warning: dist/checksums.txt not found or empty — integrity check skipped.');
  }

  let allPassed = true;
  for (const zip of zips) {
    allPassed = checkStructure(zip) && allPassed;
    if (checksums.size > 0) {
      allPassed = checkIntegrity(zip, checksums) && allPassed;
    }
  }

  if (!allPassed) {
    console.log('\nVerification FAILED.');
    process.exit(1);
  }
  console.log('\nVerification PASSED.');
}

main();
