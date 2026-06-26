# ht-md

Pick any element on a webpage and copy it as Markdown.

## Install

### Firefox

Install directly from the [Firefox Add-ons page](https://addons.mozilla.org/en-US/firefox/addon/htmd/).

### Chrome / Brave

The Chrome Web Store listing is pending review. In the meantime, install from a
[GitHub release](https://github.com/zachvp/ht-md/releases):

1. Download `ht-md-chrome.zip` and unzip it to a permanent location
   (e.g. `~/Applications/ht-md-chrome/`). Don't delete this folder — Chrome
   loads the extension from it at runtime.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top-right corner).
4. Click **Load unpacked** and select the unzipped folder.
5. Pin the extension from the toolbar extensions menu if desired.

Chrome will show a "Developer mode extensions" reminder on startup until the
store listing is live — this is expected for sideloaded extensions.

## Build Environment

- macOS or Linux
- Node.js >= 18
- npm >= 9

## Build Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Build for a specific browser target, or all of them:
   ```
   npm run build:firefox   # dist/firefox/  (load unpacked, or as a temporary add-on)
   npm run build:chrome    # dist/chrome/, dist/<name>-chrome.zip  (also loads in Brave, Edge)
   npm run build            # both (same as build:all) — no single manifest works
                             # correctly across Firefox and Chromium, so each
                             # target gets its own dist/ dir and manifest
   ```

Each target's manifest is `manifest.base.json` merged with its
`manifest.<target>.json` override (only the fields that genuinely diverge per
browser, e.g. `background`).

3. To install permanently in Firefox (not just as a temporary add-on), the
   build must be signed by Mozilla first:
   ```
   npm run sign:firefox   # dist/web-ext-artifacts/<name>_<version>.xpi (signed)
   ```
   This reads AMO API credentials from macOS Keychain (`<name>-amo-issuer` /
   `<name>-amo-secret`, where `<name>` is the `name` field in `package.json`) —
   see `scripts/sign-firefox.js` for setup. Each run
   registers that exact version with AMO, so bump `manifest.base.json`'s
   `version` before re-signing.

## Troubleshooting: "Could not establish connection. Receiving end does not exist."

After reloading the unpacked extension (or rebuilding it), Chrome/Brave does
**not** retroactively inject the content script into tabs that were already
open — only the background service worker restarts immediately. You'll see
`background.js` logs fire normally, but the content script never logs
"content script loaded" and `chrome.tabs.sendMessage` fails with this error.

**Fix**: hard-refresh the tab you're testing in (not just reload the
extension) after every rebuild/reload. This is expected browser behavior, not
a bug in the build — see the
[chromium-extensions discussion](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/JPtI0_DZP-I)
for background.
