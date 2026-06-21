#!/usr/bin/env tsx
// Publishes the Firefox build to AMO (listed channel) and signs it for local
// install (unlisted channel) in one step, keeping both versions in sync.
// Credentials are read from macOS Keychain at run time and only
// ever exist as env vars for the web-ext subprocess — never written to disk.
//
// Setup (run once):
//   security add-generic-password -a "$USER" -s "ht-md-amo-issuer" -w "<issuer>" -U
//   security add-generic-password -a "$USER" -s "ht-md-amo-secret" -w "<secret>" -U
//
// Usage:
//   npm run publish:firefox

import { execFileSync, execSync, ExecSyncOptions } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const AMO_ISSUER_SERVICE = 'ht-md-amo-issuer';
const AMO_SECRET_SERVICE = 'ht-md-amo-secret';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'dist', 'firefox');
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

const apiKey    = readKeychainSecret(AMO_ISSUER_SERVICE);
const apiSecret = readKeychainSecret(AMO_SECRET_SERVICE);
const env       = { ...process.env, WEB_EXT_API_KEY: apiKey, WEB_EXT_API_SECRET: apiSecret };
const opts: ExecSyncOptions = { cwd: ROOT, stdio: 'inherit', env };

console.log('Publishing dist/firefox to AMO (listed)...');
execSync(
  `npx web-ext sign --source-dir=${JSON.stringify(SOURCE_DIR)} --channel=listed --artifacts-dir=${JSON.stringify(ARTIFACTS_DIR)} --amo-metadata=${JSON.stringify(path.join(ROOT, 'amo-metadata.json'))}`,
  opts
);

console.log('Signing dist/firefox for local install (unlisted)...');
execSync(
  `npx web-ext sign --source-dir=${JSON.stringify(SOURCE_DIR)} --channel=unlisted --artifacts-dir=${JSON.stringify(ARTIFACTS_DIR)}`,
  opts
);
