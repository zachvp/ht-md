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

**Status: blocked — first-time manual upload required**

### What's needed (one-time)

1. **Developer account** — pay the one-time $5 registration fee at
   [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
   if not already done.

2. **First upload** — manually upload `dist/web-md-chrome.zip` as a new listing
   in the developer dashboard. Fill out store listing details (description,
   screenshots, etc.). This gives you an **extension ID**.

3. **Google OAuth credentials** — a Google Cloud project with the Chrome Web Store
   API enabled is already set up on the Raspberry Pi. You need:
   - `clientId`
   - `clientSecret`
   - `refreshToken` (one-time token exchange — run the auth flow on this Mac or copy from Pi)

4. **Store credentials in Keychain** (suggested naming):
   ```sh
   security add-generic-password -a "$USER" -s "web-md-cws-extension-id" -w "<id>" -U
   security add-generic-password -a "$USER" -s "web-md-cws-client-id" -w "<clientId>" -U
   security add-generic-password -a "$USER" -s "web-md-cws-client-secret" -w "<clientSecret>" -U
   security add-generic-password -a "$USER" -s "web-md-cws-refresh-token" -w "<refreshToken>" -U
   ```

5. **Add publish script** — once credentials exist, add `scripts/publish-chrome.js`
   (mirrors `publish-firefox.js`) using `chrome-webstore-upload-cli`:
   ```sh
   npm install --save-dev chrome-webstore-upload-cli
   ```

### After setup

```sh
npm run publish:chrome   # to be wired up after first manual upload
```

---

## Both stores at once (future)

Once Chrome is unblocked, add to `package.json`:

```json
"publish": "npm run publish:firefox & npm run publish:chrome & wait"
```

Then a single `npm run publish` deploys to both in parallel.
