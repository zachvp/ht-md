**ht-md — Reviewer Notes**

**What**
Injects a content script that lets users click any combination of visible webpage elements to copy them as Markdown. The toolbar icon activates selection mode; clicking an element highlights it and copies converted Markdown to the clipboard. No network requests are made.

**How**
1. Install the add-on, then navigate to any content-heavy page (e.g., WikiPedia, GitHub).
2. Click the ht-md toolbar icon to enter selection mode.
3. Click any page element (heading, paragraph, etc.) and paste into any text editor to verify Markdown output.
4. Try multi-element selection: hold Command/Control before selecting a page element, then click on elements to confirm combined output.
5. Open the add-on's Options page to verify settings (output format, ignored elements, etc.) persist across sessions via `storage`.

**Permissions used:**
- `activeTab` / `scripting`: inject content script on demand
- `tabs`: read active tab URL for context
- `storage`: persist user settings locally

No remote code, no external data collection.
