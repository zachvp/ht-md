#!/usr/bin/env tsx
/*
Publishes the extension to the Chrome Web Store via the chrome-webstore-upload API.
Credentials are read from macOS Keychain at run time and never written to disk.

Setup (run once):
  security add-generic-password -a "$USER" -s "web-md-cws-extension-id" -w "<extension-id>" -U
  security add-generic-password -a "$USER" -s "web-md-cws-publisher-id" -w "<publisher-id>" -U
  security add-generic-password -a "$USER" -s "web-md-cws-client-id" -w "<client-id>" -U
  security add-generic-password -a "$USER" -s "web-md-cws-client-secret" -w "<client-secret>" -U
  security add-generic-password -a "$USER" -s "web-md-cws-refresh-token" -w "<refresh-token>" -U

Usage:
  npm run publish:chrome   # uploads dist/<name>-chrome.zip and publishes it
*/

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chromeWebstoreUpload from 'chrome-webstore-upload';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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

async function main(): Promise<void> {
  const pkg: { name: string } = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const zipPath = path.join(ROOT, 'dist', `${pkg.name}-chrome.zip`);

  const store = chromeWebstoreUpload({
    extensionId: readKeychainSecret('web-md-cws-extension-id'),
    publisherId: readKeychainSecret('web-md-cws-publisher-id'),
    clientId: readKeychainSecret('web-md-cws-client-id'),
    clientSecret: readKeychainSecret('web-md-cws-client-secret'),
    refreshToken: readKeychainSecret('web-md-cws-refresh-token'),
  });

  const token = await store.fetchToken();

  console.log(`Uploading ${path.relative(ROOT, zipPath)} to the Chrome Web Store...`);
  const uploadResponse = await store.uploadExisting(zipPath, token, 60);
  if (uploadResponse.uploadState !== 'SUCCEEDED') {
    console.error('Upload failed:', JSON.stringify(uploadResponse, null, 2));
    process.exit(1);
  }

  console.log('Publishing...');
  const publishResponse = await store.publish('default', token);
  console.log(JSON.stringify(publishResponse, null, 2));
}

main().catch((err: unknown) => { console.error(err); process.exit(1); });
