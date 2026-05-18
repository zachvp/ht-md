// Firefox extension global — not in @types/chrome
declare var browser: typeof chrome | undefined

// Vendored turndown.js — loaded before content scripts via manifest
declare class TurndownService {
  turndown(html: string): string
}
