# Breadcrumbs

Known gaps and deferred decisions worth revisiting.

---

## Icon animation: OffscreenCanvas not reliable on Firefox

**Where:** `src/background.ts` — `drawEmoji()` / `animateIcon()`

**What:** The icon animation uses `OffscreenCanvas` to render emoji frames as `ImageData` for `chrome.action.setIcon()`. This works in Chrome/Brave (service worker context has `OffscreenCanvas`). Firefox uses a background script (the `scripts` array in `manifest.firefox.json`), not a service worker — `OffscreenCanvas` availability there is inconsistent across Firefox versions.

**Fix when needed:** Detect context at runtime and branch:
```typescript
const canvas = typeof OffscreenCanvas !== 'undefined'
  ? new OffscreenCanvas(size, size)
  : Object.assign(document.createElement('canvas'), { width: size, height: size })
```
Firefox background pages have DOM access, so `document.createElement('canvas')` works there.
