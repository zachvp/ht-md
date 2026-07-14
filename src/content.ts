import TurndownService from 'turndown'
import { SETTINGS_DEFAULTS, Settings } from './lib/settings.generated'
import { storage } from './lib/storage'
import { EXT_NAME, DARKREADER_CLASS, HIGHLIGHT_ALPHA, OUTLINE_OFFSET, BADGE_INSET, CLASS_SELECTED, CLASS_HOVER, CLASS_BADGE, CLASS_FLASH, CLASS_CURSOR, CLASS_OVERLAY, Z_BADGE } from './lib/constants'

const LOG = `[${EXT_NAME}]`

console.log(`${LOG} content script loaded`)

// CSS zoom on <html> or <body> shifts the coordinate space for position:fixed children.
// clientX/Y are always in viewport pixels, so we must divide by zoom when translating.
// Promotes an element into the browser's top layer so it paints above every
// page element regardless of the page's own stacking contexts (modals, portals, etc).
// Falls back to normal stacking (via each class's z-index) on browsers without support.
function promoteToTopLayer(el: HTMLElement): void {
  if (!('showPopover' in el)) return
  el.setAttribute('popover', 'manual')
  try {
    (el as HTMLElement & { showPopover: () => void }).showPopover()
  } catch {
    // showPopover() failed (e.g. rejected by the browser) — the 'popover' attribute
    // alone forces display:none via the UA stylesheet, so it must be removed too,
    // or the element stays permanently invisible instead of falling back to normal stacking.
    el.removeAttribute('popover')
  }
}

function pageZoom(): number {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom)
  return isFinite(z) && z > 0 ? z : 1
}

// All runtime picker state in one place
const state = {
  pickerActive: false,
  multiSelectActive: false,
  modifierHeld: false,
  // --- pure data: owned by the extension, never cleared by page DOM changes ---
  lastMousePos: { x: 0, y: 0 },
  selections: [] as Array<{ el: Element, snapshot: string, observer: MutationObserver, badge: HTMLDivElement }>,
  selectedSet: new Set<Element>(),
  detachedSnapshots: [] as string[],    // snapshots whose elements were removed by the page
  redoStack: [] as Array<{ el: Element, snapshot: string }>,
  cachedNavZIndex: 0,
  // --- DOM refs: always null when picker is inactive ---
  lastHighlighted: null as Element | null,
  hoverRoot: null as Element | null,
  outlineStyleEl: null as HTMLStyleElement | null,
  highlightOverlayEl: null as HTMLDivElement | null,
  // Which mechanism is currently rendering the hover highlight, and on which element.
  // 'direct' = CSS class on the element itself (browser keeps it in sync for free).
  // 'overlay' = floating div tracked via getBoundingClientRect (only for clipped elements).
  hoverMode: null as 'direct' | 'overlay' | null,
  hoverVisualEl: null as Element | null,
  overlayRafPending: false,
  cursorStyleEl: null as HTMLStyleElement | null,
  cursorEl: null as HTMLDivElement | null,
  domObserver: null as MutationObserver | null,
  pickerCleanup: [] as Array<() => void>,
  cursorCleanup: [] as Array<() => void>,
}

// User-configurable settings, kept in sync with chrome.storage.sync
const settings: Settings = { ...SETTINGS_DEFAULTS }

const isMac = navigator.platform.startsWith('Mac')
const KEY_TO_PROP: Partial<Record<string, keyof MouseEvent>> = {
  Meta:    'metaKey',
  Control: 'ctrlKey',
  Alt:     'altKey',
  Shift:   'shiftKey',
}

const PROP_TO_KEY: Partial<Record<string, string>> = {
  metaKey:    'Meta',
  ctrlKey:    'Control',
  altKey:     'Alt',
  shiftKey:   'Shift',
}

function resolveModifier(key: string): keyof MouseEvent {
  if (key === 'auto') return isMac ? 'metaKey' : 'ctrlKey'
  return KEY_TO_PROP[key] ?? (isMac ? 'metaKey' : 'ctrlKey')
}

const keyMap = {
  multiSelect: resolveModifier('auto'),
}

function makeTurndown(stripSvg: boolean): TurndownService {
  const td = new TurndownService()
  td.remove(['style', 'script', 'noscript'])
  if (stripSvg) {
    td.addRule('stripSvgElement', {
      filter: (node: HTMLElement) => node.tagName.toLowerCase() === 'svg',
      replacement: () => '[SVG]',
    })
    td.addRule('stripSvgDataUri', {
      filter: (node: HTMLElement) =>
        node.nodeName === 'IMG' &&
        node.getAttribute('src')?.startsWith('data:image/svg+xml') === true,
      replacement: (_content: string, node: Node) => {
        const alt = (node as HTMLElement).getAttribute('alt')
        return alt ? `[SVG image: ${alt}]` : '[SVG image]'
      },
    })
  }
  return td
}

const turndown = makeTurndown(false)
const turndownStripped = makeTurndown(true)

function applySettingsVars(): void {
  const s = document.documentElement.style
  s.setProperty('--badge-bg', settings.badgeBgColor)
  s.setProperty('--badge-color', settings.badgeFontColor)
  s.setProperty('--badge-font-size', `${settings.badgeFontSize}px`)
  s.setProperty('--badge-pulse-scale', String(settings.badgePulseScale / 100))
  s.setProperty('--badge-pulse-duration', `${settings.badgePulseDuration}ms`)
  s.setProperty('--flash-bg', settings.flashBgColor)
  s.setProperty('--flash-color', settings.flashFontColor)
  s.setProperty('--flash-font-size', `${settings.toastFontSize}px`)
  s.setProperty('--flash-duration', `${settings.flashDuration}ms`)
  s.setProperty('--fall-dist', `${settings.flashFallDistance}px`)
}

storage.get(SETTINGS_DEFAULTS).then(stored => {
  Object.assign(settings, stored)
  keyMap.multiSelect = resolveModifier(settings.multiSelectKey)
  applySettingsVars()
})

chrome.storage.onChanged.addListener(changes => {
  for (const key of Object.keys(settings) as (keyof Settings)[]) {
    if (key in changes) {
      (settings as Record<string, unknown>)[key] = changes[key].newValue
    }
  }
  if ('multiSelectKey' in changes) keyMap.multiSelect = resolveModifier(settings.multiSelectKey)
  if (state.pickerActive && (changes.outlineColor || changes.outlineWidth || changes.insetWidth)) {
    applyOutlineStyles()
  }
  applySettingsVars()
})

function convert(html: string): string {
  return (settings.includeSvg ? turndown : turndownStripped).turndown(html)
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Hex colors get auto-alpha applied; rgba/hsl/named values pass through as-is.
function withAlpha(color: string, alpha: number): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? hexToRgba(color, alpha) : color
}


function applyOutlineStyles(): void {
  if (!state.outlineStyleEl) {
    state.outlineStyleEl = document.createElement('style')
    state.outlineStyleEl.className = DARKREADER_CLASS
    document.head.appendChild(state.outlineStyleEl)
  }
  state.outlineStyleEl.textContent = `
    .${CLASS_SELECTED}, .${CLASS_HOVER} {
      outline: ${settings.outlineWidth}px solid ${settings.outlineColor} !important;
      outline-offset: ${OUTLINE_OFFSET} !important;
      box-shadow: inset 0 0 0 ${settings.insetWidth}px ${withAlpha(settings.outlineColor, HIGHLIGHT_ALPHA)} !important;
    }
  `
}

function clearOutlineStyles(): void {
  state.outlineStyleEl?.remove()
  state.outlineStyleEl = null
}

// Per-ancestor memoization for isClipped: sibling elements deep in the same nested
// container (e.g. product tiles on Amazon-style grids) share most of their ancestor
// chain, so caching each ancestor's clip verdict turns repeated getComputedStyle walks
// during a hover burst into an O(1) lookup after the first. Reset whenever the page's
// own DOM mutates, since that can change an ancestor's overflow/clip-path.
let clipCache = new WeakMap<Element, boolean>()
let clipCacheResetPending = false

// Throttled to once per frame: on highly dynamic pages (e.g. Amazon's constant
// carousel/price/lazy-image churn) the DOM mutation observer can fire many times
// per frame, and resetting the cache on every single batch would defeat it entirely.
function scheduleClipCacheReset(): void {
  if (clipCacheResetPending) return
  clipCacheResetPending = true
  requestAnimationFrame(() => {
    clipCacheResetPending = false
    clipCache = new WeakMap<Element, boolean>()
  })
}

// True if any ancestor between el and the viewport would visually clip an outline
// drawn around el (overflow clipping or clip-path). Elements in this situation can't
// use the direct-CSS-class outline, since the browser would crop it at the ancestor's
// bounds — they need the floating overlay instead.
function isClipped(el: Element): boolean {
  let node = el.parentElement
  const visited: Element[] = []
  while (node && node !== document.documentElement) {
    const cached = clipCache.get(node)
    if (cached !== undefined) {
      for (const v of visited) clipCache.set(v, cached)
      return cached
    }
    visited.push(node)
    const s = getComputedStyle(node)
    if (s.overflowX !== 'visible' || s.overflowY !== 'visible' || (s.clipPath !== 'none' && s.clipPath !== '')) {
      for (const v of visited) clipCache.set(v, true)
      return true
    }
    node = node.parentElement
  }
  for (const v of visited) clipCache.set(v, false)
  return false
}

function positionOverlay(el: Element): void {
  if (!state.highlightOverlayEl) {
    const div = document.createElement('div')
    div.className = CLASS_OVERLAY
    div.setAttribute('data-ht-md', 'overlay')
    document.documentElement.appendChild(div)
    promoteToTopLayer(div)
    state.highlightOverlayEl = div
  }
  const r = el.getBoundingClientRect()
  const z = pageZoom()
  const ov = state.highlightOverlayEl
  ov.style.top = `${r.top / z}px`
  ov.style.left = `${r.left / z}px`
  ov.style.width = `${r.width / z}px`
  ov.style.height = `${r.height / z}px`
  ov.style.outline = `${settings.outlineWidth}px solid ${settings.outlineColor}`
  ov.style.outlineOffset = OUTLINE_OFFSET
  ov.style.boxShadow = `inset 0 0 0 ${settings.insetWidth}px ${withAlpha(settings.outlineColor, HIGHLIGHT_ALPHA)}`
  ov.style.display = 'block'
}

function hideOverlay(): void {
  if (state.highlightOverlayEl) state.highlightOverlayEl.style.display = 'none'
}

function clearHighlightVisual(): void {
  if (state.hoverMode === 'direct' && state.hoverVisualEl) {
    state.hoverVisualEl.classList.remove(CLASS_HOVER)
  } else if (state.hoverMode === 'overlay') {
    hideOverlay()
  }
  state.hoverVisualEl = null
  state.hoverMode = null
}

// Renders the hover highlight on el, preferring a direct CSS class (self-syncing —
// the browser repaints it on every reflow with zero JS) and falling back to the
// tracked overlay div only when an ancestor would clip a direct outline.
function showHighlight(el: Element): void {
  clearHighlightVisual()
  if (isClipped(el)) {
    state.hoverMode = 'overlay'
    positionOverlay(el)
  } else {
    state.hoverMode = 'direct'
    el.classList.add(CLASS_HOVER)
  }
  state.hoverVisualEl = el
}

function hideHighlight(): void {
  clearHighlightVisual()
}

function cursorFontSize(): number {
  return Math.round(settings.cursorSize * 0.875)
}

function setCursor(emoji: string): void {
  if (!state.cursorStyleEl) {
    state.cursorStyleEl = document.createElement('style')
    state.cursorStyleEl.className = DARKREADER_CLASS
    state.cursorStyleEl.textContent = '* { cursor: none !important; }'
    document.head.appendChild(state.cursorStyleEl)
  }
  if (!state.cursorEl) {
    const el = document.createElement('div')
    el.className = CLASS_CURSOR
    el.setAttribute('data-ht-md', 'cursor')
    const initOy = cursorFontSize() + settings.cursorOffsetY
    const initZ = pageZoom()
    el.style.transform = `translate(${(state.lastMousePos.x + settings.cursorOffsetX) / initZ}px,${(state.lastMousePos.y - initOy) / initZ}px)`
    document.documentElement.appendChild(el)
    promoteToTopLayer(el)
    state.cursorEl = el
    state.cursorCleanup.push(
      tracked(document, 'mousemove', (e: Event) => {
        const { clientX, clientY } = e as MouseEvent
        const oy = cursorFontSize() + settings.cursorOffsetY
        const z = pageZoom()
        state.cursorEl!.style.transform = `translate(${(clientX + settings.cursorOffsetX) / z}px,${(clientY - oy) / z}px)`
      }),
      tracked(document, 'mouseleave', () => { state.cursorEl!.style.visibility = 'hidden' }),
      tracked(document, 'mouseenter', () => { state.cursorEl!.style.visibility = 'visible' }),
    )
  }
  state.cursorEl!.textContent = emoji
  state.cursorEl!.style.fontSize = `${cursorFontSize()}px`
}

function clearCursor(): void {
  state.cursorStyleEl?.remove()
  state.cursorStyleEl = null
  state.cursorEl?.remove()
  state.cursorEl = null
  for (const cleanup of state.cursorCleanup) cleanup()
  state.cursorCleanup.length = 0
}

function tracked(
  target: EventTarget, event: string,
  fn: EventListenerOrEventListenerObject,
  opts?: boolean | AddEventListenerOptions
): () => void {
  target.addEventListener(event, fn, opts)
  return () => target.removeEventListener(event, fn, opts as boolean | undefined)
}

function syncCursor(): void {
  setCursor(state.modifierHeld ? settings.multiCursorEmoji : settings.cursorEmoji)
}

function createBadge(index: Number): HTMLDivElement {
  const badge = document.createElement('div')
  badge.className = CLASS_BADGE
  badge.textContent = String(index)
  badge.style.zIndex = String(state.cachedNavZIndex || Z_BADGE)
  badge.setAttribute('data-ht-md', 'badge')
  if (settings.badgePulse)
    badge.classList.add(`${CLASS_BADGE}-pulse`)
  return badge
}

function createMessage(content: string | Node): HTMLDivElement {
  const el = document.createElement('div')
  el.className = CLASS_FLASH
  el.setAttribute('data-ht-md', 'message')
  if (typeof content === 'string') {
    el.textContent = content
  } else {
    if (content instanceof HTMLElement && content.classList.contains(CLASS_BADGE))
      content.classList.add(`${CLASS_BADGE}--inline`)
    el.appendChild(content)
  }
  return el
}

function navZIndex(): number {
  let min = Infinity
  for (const el of document.querySelectorAll<HTMLElement>('header, nav, [role="banner"], [role="navigation"]')) {
    const s = getComputedStyle(el)
    if (s.position !== 'fixed' && s.position !== 'sticky') continue
    const z = parseInt(s.zIndex)
    if (!isNaN(z)) min = Math.min(min, z)
  }
  return isFinite(min) ? min - 1 : Z_BADGE
}

function safeZone(): { top: number, bottom: number, left: number, right: number } {
  let top = 0, bottom = window.innerHeight, left = 0, right = window.innerWidth
  const GAP = 8
  let changed = true
  while (changed) {
    changed = false
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      const s = getComputedStyle(el)
      if (s.position !== 'fixed' && s.position !== 'sticky') continue
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.top <= top + GAP && r.bottom > top)    { top    = r.bottom; changed = true }
      if (r.bottom >= bottom - GAP && r.top < bottom) { bottom = r.top;    changed = true }
      if (r.left <= left + GAP && r.right > left)  { left   = r.right;  changed = true }
      if (r.right >= right - GAP && r.left < right){ right  = r.left;   changed = true }
    }
  }
  return { top, bottom, left, right }
}

const NAV_SELECTOR = 'header, nav, [role="banner"], [role="navigation"]'

function syncBadgeVisibility(badge: HTMLDivElement): void {
  const b = badge.getBoundingClientRect()
  const obscured = Array.from(document.querySelectorAll<HTMLElement>(NAV_SELECTOR)).some(nav => {
    const s = getComputedStyle(nav)
    if (s.position !== 'fixed' && s.position !== 'sticky') return false
    const n = nav.getBoundingClientRect()
    return b.left < n.right && b.right > n.left && b.top < n.bottom && b.bottom > n.top
  })
  const newVisibility = obscured ? 'hidden' : ''
  if (badge.style.visibility !== newVisibility) badge.style.visibility = newVisibility
}

function addBadge(el: Element, index: number): HTMLDivElement {
  const r = el.getBoundingClientRect()
  const badge = createBadge(index)
  document.documentElement.appendChild(badge)
  promoteToTopLayer(badge)
  const z = pageZoom()
  const sz = safeZone()
  const top  = Math.max(r.top  + BADGE_INSET, sz.top  + BADGE_INSET)
  const left = Math.min(r.right - badge.offsetWidth - BADGE_INSET, sz.right - badge.offsetWidth - BADGE_INSET)
  badge.style.top  = `${top  / z}px`
  badge.style.left = `${left / z}px`
  syncBadgeVisibility(badge)
  return badge
}

function repositionBadges(): void {
  const sz = safeZone()
  const z = pageZoom()
  for (const { el, badge } of state.selections) {
    const r = el.getBoundingClientRect()
    const top  = Math.max(r.top  + BADGE_INSET, sz.top  + BADGE_INSET)
    const left = Math.min(r.right - badge.offsetWidth - BADGE_INSET, sz.right - badge.offsetWidth - BADGE_INSET)
    badge.style.top  = `${top  / z}px`
    badge.style.left = `${left / z}px`
    syncBadgeVisibility(badge)
  }
  if (state.hoverMode === 'overlay' && state.hoverVisualEl && document.contains(state.hoverVisualEl)) {
    positionOverlay(state.hoverVisualEl)
  }
}

function watchSelectionClass(el: Element): MutationObserver {
  const obs = new MutationObserver(() => {
    if (!el.classList.contains(CLASS_SELECTED)) el.classList.add(CLASS_SELECTED)
  })
  obs.observe(el, { attributes: true, attributeFilter: ['class'] })
  return obs
}

function clearBadges(): void {
  for (const { badge } of state.selections) badge.remove()
}

function selectionCount(): number {
  return state.detachedSnapshots.length + state.selections.length
}

function addSelection(el: Element): void {
  const index = selectionCount() + 1
  el.classList.add(CLASS_SELECTED)
  const observer = watchSelectionClass(el)
  const badge = addBadge(el, index)
  state.selections.push({ el, snapshot: el.outerHTML, observer, badge })
  state.selectedSet.add(el)
}

function clearSelection(): void {
  for (const { observer, el, badge } of state.selections) {
    observer.disconnect()
    el.classList.remove(CLASS_SELECTED)
    badge.remove()
  }
  state.selections.length = 0
  state.selectedSet.clear()
  state.detachedSnapshots.length = 0
  state.redoStack.length = 0
  state.multiSelectActive = false
}

function clearHover(): void {
  clearHighlightVisual()
  state.highlightOverlayEl?.remove()
  state.highlightOverlayEl = null
  state.lastHighlighted = null
  state.hoverRoot = null
}

function notifyPickerState(active: boolean): void {
  if (!chrome.runtime?.id) return
  chrome.runtime.sendMessage({ action: 'pickerState', active }).catch(() => {})
}

function activatePicker(): void {
  if (state.pickerActive) return
  state.pickerActive = true
  state.cachedNavZIndex = navZIndex()
  console.log(`${LOG} picker activated`)
  try {
    clipCache = new WeakMap<Element, boolean>()
    applyOutlineStyles()
    setCursor(settings.cursorEmoji)
    state.pickerCleanup.push(tracked(document, 'mousemove', (e: Event) => {
      const { clientX, clientY } = e as MouseEvent
      state.lastMousePos = { x: clientX, y: clientY }
    }, true))
    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)

    state.domObserver = new MutationObserver(() => {
      scheduleClipCacheReset()
      if (state.lastHighlighted && !document.contains(state.lastHighlighted)) {
        hideHighlight()
        state.lastHighlighted = null
        state.hoverRoot = null
      }
      // Direct-class highlights repaint themselves on any reflow — only the overlay
      // fallback needs to be re-measured when the page mutates itself (e.g. a site's
      // own hover-triggered flyout/animation shifting layout under the cursor).
      if (state.hoverMode === 'overlay' && state.hoverVisualEl && document.contains(state.hoverVisualEl) && !state.overlayRafPending) {
        state.overlayRafPending = true
        requestAnimationFrame(() => {
          state.overlayRafPending = false
          if (state.hoverMode === 'overlay' && state.hoverVisualEl && document.contains(state.hoverVisualEl)) {
            positionOverlay(state.hoverVisualEl)
          }
        })
      }
      if (state.selections.some(s => !document.contains(s.el))) {
        // Presentation cleanup only — snapshots are extension data, not tied to page lifecycle
        const kept: typeof state.selections = []
        clearBadges()
        for (const s of state.selections) {
          if (document.contains(s.el)) {
            kept.push(s)
          } else {
            s.observer.disconnect()
            state.detachedSnapshots.push(s.snapshot)
          }
        }
        state.selections.length = 0
        state.selectedSet.clear()
        for (let i = 0; i < kept.length; i++) {
          const { el, snapshot, observer } = kept[i]
          el.classList.add(CLASS_SELECTED)
          const badge = addBadge(el, state.detachedSnapshots.length + i + 1)
          state.selections.push({ el, snapshot, observer, badge })
          state.selectedSet.add(el)
        }
        state.multiSelectActive = selectionCount() > 0
      }
    })
    state.domObserver.observe(document.body, { childList: true, subtree: true })

    const scrollResizeHandler = () => repositionBadges()
    state.pickerCleanup.push(
      tracked(window, 'scroll', scrollResizeHandler, { capture: true, passive: true }),
      tracked(window, 'resize', scrollResizeHandler),
    )

    notifyPickerState(true)
  } catch (err) {
    console.error(`${LOG} activatePicker failed:`, err)
    deactivatePicker()
  }
}

function deactivatePicker(message?: string | HTMLDivElement): void {
  if (!state.pickerActive) return
  state.pickerActive = false
  state.modifierHeld = false
  console.log(`${LOG} picker deactivated`)
  notifyPickerState(false)

  clearOutlineStyles()
  clearCursor()
  clearHover()
  clearSelection()

  for (const cleanup of state.pickerCleanup) cleanup()
  state.pickerCleanup.length = 0
  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  document.removeEventListener('keyup', onKeyUp, true)

  state.domObserver?.disconnect()
  state.domObserver = null


  if (message) showMessage(typeof message === 'string' ? createMessage(message) : message)
}

function onMouseOver(e: MouseEvent): void {
  state.lastMousePos = { x: e.clientX, y: e.clientY }
  const target = e.target as Element
  if (target === document.body || target === document.documentElement) {
    hideHighlight()
    state.lastHighlighted = null
    state.hoverRoot = null
    return
  }
  state.hoverRoot = target
  state.lastHighlighted = target
  if (!state.multiSelectActive || state.modifierHeld) {
    showHighlight(target)
  } else {
    hideHighlight()
  }
}

function onClick(e: MouseEvent): void {
  if (!e.isTrusted) return

  if (!e[keyMap.multiSelect]) {
    if (state.multiSelectActive) return  // fall through to browser
    // Single-select mode, bare click: capture immediately
    const el = (state.lastHighlighted ?? e.target) as Element

    e.preventDefault()
    e.stopPropagation()
    const md = convert(el.outerHTML)
    console.log(`${LOG} single click capture — md length:`, md.length)
    navigator.clipboard.writeText(md)
      .then(() => { console.log(`${LOG} clipboard write ok`); deactivatePicker('📝 Copied') })
      .catch((err: Error) => { console.error(`${LOG} clipboard write failed:`, err.message); deactivatePicker('Error: ' + err.message) })
    return
  }

  // Modifier held: add to selection
  const el = (state.lastHighlighted ?? e.target) as Element
  e.preventDefault()
  e.stopPropagation()
  addSelection(el)
  state.redoStack.length = 0
  if (!state.multiSelectActive) state.multiSelectActive = true
  showMessage(createMessage(`${selectionCount()} selected — Enter to copy`))
}

function undoSelection(): void {
  if (state.selections.length > 0) {
    const { el, snapshot, observer, badge } = state.selections.pop()!
    observer.disconnect()
    state.selectedSet.delete(el)
    el.classList.remove(CLASS_SELECTED)
    badge.remove()
    state.redoStack.push({ el, snapshot })
  } else {
    // Live refs exhausted; undo the most recent detached snapshot
    state.detachedSnapshots.pop()
  }
  if (selectionCount() === 0) {
    state.multiSelectActive = false
    syncCursor()
    showMessage(createMessage('Selection cleared'))
  } else {
    showMessage(createMessage(`${selectionCount()} selected — Enter to copy`))
  }
}

function redoSelection(): void {
  const { el, snapshot } = state.redoStack.pop()!
  el.classList.add(CLASS_SELECTED)
  const observer = watchSelectionClass(el)
  const badge = addBadge(el, selectionCount() + 1)
  state.selections.push({ el, snapshot, observer, badge })
  state.selectedSet.add(el)
  if (!state.multiSelectActive) state.multiSelectActive = true
  showMessage(createMessage(`${selectionCount()} selected — Enter to copy`))
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === PROP_TO_KEY[keyMap.multiSelect]) {
    state.modifierHeld = true
    syncCursor()
    if (state.lastHighlighted) showHighlight(state.lastHighlighted)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopImmediatePropagation()
    deactivatePicker('Canceled')
  } else if ((e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft') && selectionCount() > 0) {
    e.preventDefault()
    e.stopImmediatePropagation()
    undoSelection()
  } else if (e.key === 'ArrowRight' && state.redoStack.length > 0) {
    e.preventDefault()
    e.stopImmediatePropagation()
    redoSelection()
  } else if (e.key === 'ArrowUp' && state.lastHighlighted && (!state.multiSelectActive || state.modifierHeld)) {
    e.preventDefault()
    e.stopImmediatePropagation()
    const parent = state.lastHighlighted.parentElement
    if (parent && parent !== document.documentElement) {
      state.lastHighlighted = parent
      showHighlight(parent)
    }
  } else if (e.key === 'ArrowDown' && state.lastHighlighted && state.hoverRoot && state.lastHighlighted !== state.hoverRoot && (!state.multiSelectActive || state.modifierHeld)) {
    e.preventDefault()
    e.stopImmediatePropagation()
    // Walk from hoverRoot up to find the direct child of lastHighlighted
    let el: Element | null = state.hoverRoot
    while (el && el.parentElement !== state.lastHighlighted) {
      el = el.parentElement
    }
    if (el) {
      state.lastHighlighted = el
      showHighlight(el)
    }
  } else if (e.key === 'Enter' && (selectionCount() > 0 || state.lastHighlighted)) {
    e.preventDefault()
    e.stopImmediatePropagation()
    const allSnapshots = [...state.detachedSnapshots, ...state.selections.map(s => s.snapshot)]
    const snapshots = allSnapshots.length > 0 ? allSnapshots : [state.lastHighlighted!.outerHTML]
    const count = snapshots.length
    const md = snapshots.map(html => convert(html)).join('\n')
    console.log(`${LOG} committing`, snapshots.length, 'elements — md length:', md.length)
    navigator.clipboard.writeText(md)
      .then(() => {
        console.log(`${LOG} clipboard write ok`)
        const msg = createMessage(createBadge(count))
        msg.appendChild(document.createTextNode(' Copied'))
        deactivatePicker(msg)
      })
      .catch((err: Error) => { console.error(`${LOG} clipboard write failed:`, err.message); deactivatePicker('Error: ' + err.message) })
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === PROP_TO_KEY[keyMap.multiSelect]) {
    state.modifierHeld = false
    syncCursor()
    if (state.multiSelectActive) hideHighlight()
  }
}

function showMessage(el: HTMLDivElement): void {
  const initZ = pageZoom()
  el.style.left = `${state.lastMousePos.x / initZ}px`
  el.style.top = `${state.lastMousePos.y / initZ}px`
  el.style.transform = 'translate(-50%, -50%)'
  el.style.animationName = 'none'
  document.documentElement.appendChild(el)
  promoteToTopLayer(el)

  setTimeout(() => {
    const r = el.getBoundingClientRect()
    const z = pageZoom()
    const sz = safeZone()
    const hw = r.width / 2, hh = r.height / 2
    const cx = Math.max(sz.left + hw, Math.min(sz.right  - hw, r.left + hw))
    const cy = Math.max(sz.top  + hh, Math.min(sz.bottom - hh, r.top  + hh))
    el.style.left = `${cx / z}px`
    el.style.top  = `${cy / z}px`
    el.style.transform = ''
    el.style.animationName = ''
    el.style.animationDelay = '0ms'
  }, settings.flashPause)

  setTimeout(() => el.remove(), settings.flashPause + settings.flashDuration)
}

chrome.runtime.onMessage.addListener((msg: { action: string }) => {
  console.log(`${LOG} message received:`, msg)
  if (msg.action === 'toggle' || msg.action === 'activate') {
    if (state.pickerActive) deactivatePicker()
    else activatePicker()
  }
})
