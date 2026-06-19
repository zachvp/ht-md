// Vendored turndown.js — loaded before content scripts via manifest
declare class TurndownService {
  turndown(html: string): string
  remove(tags: string[]): void
  addRule(key: string, rule: {
    filter: string | string[] | ((node: HTMLElement) => boolean)
    replacement: (content: string, node: Node) => string
  }): TurndownService
}
