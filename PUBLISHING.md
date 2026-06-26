# Publishing

One-command deploy target per store once setup is complete.

## Firefox (AMO)

**Status: ready to run**

```sh
npm run publish:firefox
```

Builds `dist/firefox/`, then calls `web-ext sign --channel=listed` using AMO credentials
from macOS Keychain. Submits to addons.mozilla.org. AMO typically processes updates
within minutes; manual review can take up to 24h.

### Credentials (already configured)

Stored in macOS Keychain — no plaintext secrets on disk.

| Keychain service | Value |
|---|---|
| `ht-md-amo-issuer` | `user:17745296:42` |
| `ht-md-amo-secret` | (JWT secret from addons.mozilla.org/en-US/developers/addon/api/key/) |

Key names are derived from the `"name"` field in `package.json` (`ht-md`).

To re-add if needed:
```sh
security add-generic-password -a "$USER" -s "ht-md-amo-issuer" -w "user:17745296:42" -U
security add-generic-password -a "$USER" -s "ht-md-amo-secret" -w "<secret>" -U
```

### AMO listing
- URL: https://addons.mozilla.org/en-US/firefox/addon/htmd/
- UUID: `web-md@local` (matches `manifest.firefox.json`)

---

## Chrome / Brave (Chrome Web Store)

**Status: pending store review**

The initial listing has been submitted to the Chrome Web Store and is awaiting
Google's review. Once approved, the store page will be linked here and
`npm run publish:chrome` will handle subsequent releases.

### Pre-release / sideload install (while review is pending)

There is no CLI path to install a Chrome extension into a running browser —
`--load-extension` requires relaunching Chrome entirely, making it impractical
for end users. The supported sideload flow is **Load unpacked** via developer mode:

1. Download `ht-md-chrome.zip` from the [GitHub release](https://github.com/zachvp/ht-md/releases).
2. Unzip it to a permanent location (e.g. `~/Applications/ht-md-chrome/`).
   Do not delete this folder — Chrome loads the extension from it at runtime.
3. Open `chrome://extensions` in Chrome or Brave.
4. Toggle **Developer mode** on (top-right corner).
5. Click **Load unpacked** and select the unzipped folder.
6. The extension icon will appear in the toolbar. Pin it from the extensions menu if desired.

> Chrome will show a persistent "Developer mode extensions" reminder on startup.
> This is normal for sideloaded extensions and goes away once the store listing is live.

### After store approval

The publish script still needs to be wired up post-approval. Once the extension
ID is known, complete the one-time credential setup:

```sh
security add-generic-password -a "$USER" -s "web-md-cws-extension-id" -w "<id>" -U
security add-generic-password -a "$USER" -s "web-md-cws-client-id" -w "<clientId>" -U
security add-generic-password -a "$USER" -s "web-md-cws-client-secret" -w "<clientSecret>" -U
security add-generic-password -a "$USER" -s "web-md-cws-refresh-token" -w "<refreshToken>" -U
```

Then add `scripts/publish-chrome.js` (mirrors `publish-firefox.js`) using
`chrome-webstore-upload-cli`:

```sh
npm install --save-dev chrome-webstore-upload-cli
npm run publish:chrome
```

---

## Both stores at once (future)

Once Chrome is unblocked, add to `package.json`:

```json
"publish": "npm run publish:firefox & npm run publish:chrome & wait"
```

Then a single `npm run publish` deploys to both in parallel.
