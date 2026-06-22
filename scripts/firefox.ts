#!/usr/bin/env tsx
/*
Manages Firefox build signing and AMO publishing.
Credentials are read from macOS Keychain at run time, and only
ever exist as env vars for the web-ext subprocess — never written to disk.

Setup (run once):
  security add-generic-password -a "$USER" -s "ht-md-amo-issuer" -w "<issuer>" -U
  security add-generic-password -a "$USER" -s "ht-md-amo-secret" -w "<secret>" -U

Usage:
  npm run sign:firefox      # sign for local install (unlisted); fetches from AMO if already submitted
  npm run publish:firefox   # publish to AMO (listed) + sign (unlisted)
*/

import crypto from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AMO_ISSUER_SERVICE = 'ht-md-amo-issuer';
const AMO_SECRET_SERVICE = 'ht-md-amo-secret';
const ADDON_ID           = 'web-md@local';

const ROOT         = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR   = path.join(ROOT, 'dist', 'firefox');
const ARTIFACTS_DIR = path.join(ROOT, 'dist', 'web-ext-artifacts');

function readKeychainSecret(service: string): string {
  try {
    return execFileSync(
      'security',
      ['find-generic-password', '-a', process.env.USER!, '-s', service, '-w'],
      { encoding: 'utf8' }
    ).trim();
  } catch {
    console.error(
      `Could not read Keychain item "${service}" for account "${process.env.USER}".\n` +
        `Add it with:\n` +
        `  security add-generic-password -a "$USER" -s "${service}" -w "<value>" -U`
    );
    process.exit(1);
  }
}

function makeAmoJwt(apiKey: string, apiSecret: string): string {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: apiKey,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 60,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', apiSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

function xpiFilename(): string {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return `${pkg.name}-firefox.xpi`;
}

async function fetchExistingXpi(apiKey: string, apiSecret: string, version: string): Promise<void> {
  const token = makeAmoJwt(apiKey, apiSecret);
  const headers = { Authorization: `JWT ${token}` };

  // Try with and without the filter — purely-unlisted addons don't need it
  const endpoints = [
    `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(ADDON_ID)}/versions/?filter=all_with_unlisted&page_size=50`,
    `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(ADDON_ID)}/versions/?page_size=50`,
  ];

  for (const startUrl of endpoints) {
    let url: string | null = startUrl;
    while (url) {
      const res  = await fetch(url, { headers });
      if (!res.ok) { url = null; break; }
      const data = await res.json() as any;

      for (const v of data.results ?? []) {
        if (v.version !== version) continue;
        // API v5 returns a single `file` object per version, not an array
        const f = v.file;
        if (!f?.url) continue;
        const filename = xpiFilename();
        console.log(`Downloading existing XPI from AMO as ${filename}...`);
        const xpiRes = await fetch(f.url, { headers });
        const buf    = await xpiRes.arrayBuffer();
        mkdirSync(ARTIFACTS_DIR, { recursive: true });
        writeFileSync(path.join(ARTIFACTS_DIR, filename), Buffer.from(buf));
        console.log(`Saved to dist/web-ext-artifacts/${filename}`);
        return;
      }
      url = data.next ?? null;
    }
  }

  throw new Error(`Could not find XPI for version ${version} on AMO.`);
}

async function sign(apiKey: string, apiSecret: string): Promise<void> {
  const env  = { ...process.env, WEB_EXT_API_KEY: apiKey, WEB_EXT_API_SECRET: apiSecret };
  const args = [
    'web-ext', 'sign',
    `--source-dir=${SOURCE_DIR}`,
    '--channel=unlisted',
    `--artifacts-dir=${ARTIFACTS_DIR}`,
  ];

  console.log('Signing dist/firefox for local install (unlisted)...');
  const result = spawnSync('npx', args, { cwd: ROOT, env, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  process.stdout.write(output);

  if (result.status === 0) {
    // web-ext names the file after the GUID; rename to match the chrome artifact convention
    const target = xpiFilename();
    const produced = readdirSync(ARTIFACTS_DIR).find(f => f.endsWith('.xpi') && f !== target);
    if (produced) {
      renameSync(path.join(ARTIFACTS_DIR, produced), path.join(ARTIFACTS_DIR, target));
      console.log(`Renamed ${produced} -> ${target}`);
    }
    return;
  }

  if (output.includes('already exists')) {
    const version = JSON.parse(readFileSync(path.join(ROOT, 'manifest.base.json'), 'utf8')).version as string;
    console.log(`Version ${version} already submitted — fetching existing XPI from AMO...`);
    await fetchExistingXpi(apiKey, apiSecret, version);
    return;
  }

  process.exit(result.status ?? 1);
}

async function publish(apiKey: string, apiSecret: string): Promise<void> {
  const amoMetaPath    = path.join(ROOT, 'amo-metadata.json');
  const whiteboardPath = path.join(ROOT, 'amo-whiteboard.md');
  const amoMeta = JSON.parse(readFileSync(amoMetaPath, 'utf8'));
  amoMeta.version ??= {};
  amoMeta.version.approval_notes = readFileSync(whiteboardPath, 'utf8').trim();
  const tmpMetaPath = path.join(ROOT, 'dist', 'amo-metadata-with-whiteboard.json');
  writeFileSync(tmpMetaPath, JSON.stringify(amoMeta, null, 2));

  const env  = { ...process.env, WEB_EXT_API_KEY: apiKey, WEB_EXT_API_SECRET: apiSecret };
  const args = [
    'web-ext', 'sign',
    `--source-dir=${SOURCE_DIR}`,
    '--channel=listed',
    `--artifacts-dir=${ARTIFACTS_DIR}`,
    `--amo-metadata=${tmpMetaPath}`,
  ];

  console.log('Publishing dist/firefox to AMO (listed)...');
  const result = spawnSync('npx', args, { cwd: ROOT, env, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);

  await sign(apiKey, apiSecret);
}

const cmd = process.argv[2];
if (cmd !== 'sign' && cmd !== 'publish') {
  console.error('Usage: tsx scripts/firefox.ts <sign|publish>');
  process.exit(1);
}

const apiKey    = readKeychainSecret(AMO_ISSUER_SERVICE);
const apiSecret = readKeychainSecret(AMO_SECRET_SERVICE);

const run = cmd === 'sign' ? sign(apiKey, apiSecret) : publish(apiKey, apiSecret);
run.catch((err: unknown) => { console.error(err); process.exit(1); });
