# web-md

Pick any element on a webpage and copy it as Markdown.

## Build Environment

- macOS or Linux
- Node.js >= 18
- npm >= 9

## Build Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Build for a specific browser target:
   ```
   npm run build:firefox   # dist/firefox/, web-md-firefox.xpi
   npm run build:chrome    # dist/chrome/,  web-md-chrome.zip  (also loads in Brave, Edge)
   npm run build:all       # both
   ```

   `npm run build` with no target intentionally errors — there's no single manifest
   that works correctly across Firefox and Chromium (MV3 background scripts differ),
   so a target must be picked explicitly.

Each target's manifest is `manifest.base.json` merged with its
`manifest.<target>.json` override (only the fields that genuinely diverge per
browser, e.g. `background`).
