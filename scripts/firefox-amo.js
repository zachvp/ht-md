#!/usr/bin/env node
// Signs or publishes the Firefox build via AMO.
// Credentials are read from macOS Keychain at run time and only
// ever exist as env vars for the web-ext subprocess — never written to disk.
//
// Setup (run once):
//   security add-generic-password -a "$USER" -s "ht-md-amo-issuer" -w "<issuer>" -U
//   security add-generic-password -a "$USER" -s "ht-md-amo-secret" -w "<secret>" -U
//
// Usage:
//   node scripts/firefox-amo.js listed    # publish to AMO (npm run publish:firefox)
//   node scripts/firefox-amo.js unlisted  # sign for local install (npm run sign:firefox)

const { execFileSync, execSync } = require('child_process');
const path = require('path');

const AMO_ISSUER_SERVICE = 'ht-md-amo-issuer';
const AMO_SECRET_SERVICE = 'ht-md-amo-secret';

const channel = process.argv[2];
if (channel !== 'listed' && channel !== 'unlisted') {
  console.error('Usage: node scripts/firefox-amo.js <listed|unlisted>');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'dist', 'firefox');
const ARTIFACTS_DIR = path.join(ROOT, 'dist', 'web-ext-artifacts');

function readKeychainSecret(service) {
  try {
    return execFileSync(
      'security',
      ['find-generic-password', '-a', process.env.USER, '-s', service, '-w'],
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

const label = channel === 'listed' ? 'Publishing' : 'Signing';
console.log(`${label} dist/firefox to AMO (${channel} channel)...`);

const metadataFlag = channel === 'listed'
  ? ` --amo-metadata=${JSON.stringify(path.join(ROOT, 'amo-metadata.json'))}`
  : '';

execSync(
  `npx web-ext sign --source-dir=${JSON.stringify(SOURCE_DIR)} --channel=${channel} --artifacts-dir=${JSON.stringify(ARTIFACTS_DIR)}${metadataFlag}`,
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, WEB_EXT_API_KEY: apiKey, WEB_EXT_API_SECRET: apiSecret },
  }
);
