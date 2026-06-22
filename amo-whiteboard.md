**ht-md — Reviewer Notes**

**What it does:** Injects a content script that lets users click webpage elements (or drag-select multiple) to copy them as Markdown. The toolbar icon activates selection mode; clicking an element highlights it and copies converted Markdown to the clipboard. No network requests are made.

**How to test:**
1. Install the add-on, then navigate to any content-heavy page (e.g. a Wikipedia article or a GitHub README).
2. Click the ht-md toolbar icon to enter selection mode — the cursor changes and elements highlight on hover.
3. Click any element (heading, paragraph, list, table, image). A notification confirms the copy; paste into any text editor to verify Markdown output.
4. Try multi-element selection (hold Shift or drag) to confirm combined output.
5. Open the add-on's Options page to verify settings (output format, ignored elements, etc.) persist across sessions via `storage`.

**Permissions used:**
- `activeTab` / `scripting` — inject content script on demand
- `tabs` — read active tab URL for context
- `storage` — persist user settings locally

No remote code, no external data collection.
