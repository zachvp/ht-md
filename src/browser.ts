export const BROWSER: 'firefox' | 'chrome' = typeof browser !== 'undefined' ? 'firefox' : 'chrome'
export const api: typeof chrome = BROWSER === 'firefox' ? browser as typeof chrome : chrome
