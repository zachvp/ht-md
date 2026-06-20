export const storage = {
  get(keys: Record<string, unknown>): Promise<Record<string, unknown>> {
    return chrome.storage.sync.get(keys).catch(() => chrome.storage.local.get(keys))
  },
  set(items: Record<string, unknown>): Promise<void> {
    return chrome.storage.sync.set(items).catch(() => chrome.storage.local.set(items))
  },
}
