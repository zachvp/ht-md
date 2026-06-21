#!/usr/bin/env node
// Publishes the Firefox build to AMO (listed channel).
// Credentials are read from macOS Keychain at run time and only
// ever exist as env vars for the web-ext subprocess — never written to disk.
//
// Setup (run once):
//   security add-generic-password -a "$USER" -s "<name>-amo-issuer" -w "<issuer>" -U
//   security add-generic-password -a "$USER" -s "<name>-amo-secret" -w "<secret>" -U
// (where <name> is the "name" field in package.json)
//
// Usage:
//   npm run publish:firefox

const { execFileSync, execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg  = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const SOURCE_DIR = path.join(ROOT, 'dist', 'firefox');

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

const apiKey    = readKeychainSecret(`${pkg.name}-amo-issuer`);
const apiSecret = readKeychainSecret(`${pkg.name}-amo-secret`);

const ARTIFACTS_DIR = path.join(ROOT, 'dist', 'web-ext-artifacts');

console.log(`Publishing ${path.relative(ROOT, SOURCE_DIR)} to AMO (listed channel)...`);
execSync(
  `npx web-ext sign --source-dir=${JSON.stringify(SOURCE_DIR)} --channel=listed --artifacts-dir=${JSON.stringify(
    ARTIFACTS_DIR
  )}`,
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, WEB_EXT_API_KEY: apiKey, WEB_EXT_API_SECRET: apiSecret },
  }
);
