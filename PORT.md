# Porting the Settings Pattern to a New Static Site

The settings system here is almost entirely portable. The architecture —
declarative field definitions → codegen → field builders → wiring loop — is
storage-agnostic. Only one file and one listener are extension-specific.

## What to replace

### 1. `src/lib/storage.ts` — the only hard extension dependency

Swap the `chrome.storage` implementation for a `localStorage` adapter.
The `StorageAdapter` type documents the required shape:

```ts
export const storage: StorageAdapter = {
  get(keys: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    for (const [k, def] of Object.entries(keys)) {
      const raw = localStorage.getItem(k)
      result[k] = raw !== null ? JSON.parse(raw) : def
    }
    return Promise.resolve(result)
  },
  set(items: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(items)) {
      localStorage.setItem(k, JSON.stringify(v))
    }
    return Promise.resolve()
  },
}
```

### 2. `src/options.ts` — one listener to remove

Delete or replace the `chrome.storage.onChanged.addListener(...)` block near
the bottom. In a static site you can replace it with a `window` storage event
listener if you need cross-tab sync, or just remove it entirely.

### 3. `src/options/definitions.ts` — replace SECTIONS with your fields

Clear out the `SECTIONS` array and replace with your app's fields. Leave one
example of each field type as a reference while scaffolding, then remove them.
The type vocabulary (`NumberField`, `ColorField`, `CheckboxField`, etc.) stays
as-is — it's infrastructure.

## What stays unchanged

- All type definitions in `definitions.ts`
- The codegen script (`scripts/gen-elements.ts`) — runs as-is
- The field builder functions in `options.ts` (`buildNumberField`, etc.)
- The wiring loop (load → populate → listen → save)
- Import/export (JSON copy, file export, file import)
- The `els` accessor pattern and `elements.generated.ts`

## Strip-down checklist

1. Replace `storage.ts` with the `localStorage` adapter above
2. Remove `chrome.storage.onChanged.addListener(...)` from `options.ts`
3. Clear `SECTIONS` in `definitions.ts` — leave one field per type as scaffold
4. Delete the preview widgets from `options.ts` (the `#region * Previews *` block)
5. Run codegen (`npm run gen`) — verify it produces clean output for your new fields
6. Done: ~100-line `options.ts`, working codegen, placeholder field vocabulary
