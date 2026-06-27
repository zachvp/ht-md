import TurndownService from 'turndown'
import { SETTINGS_DEFAULTS, Settings } from './lib/settings.generated'
import { storage } from './lib/storage'
import { EXT_NAME, DARKREADER_CLASS, HIGHLIGHT_ALPHA, OUTLINE_OFFSET, BADGE_INSET, CLASS_SELECTED, CLASS_BADGE, CLASS_FLASH, CLASS_CURSOR, CLASS_OVERLAY } from './lib/constants'

const LOG = `[${EXT_NAME}]`

console.log(`${LOG} content script loaded`)

// CSS zoom on <html> or <body> shifts the coordinate space for position:fixed children.
// clientX/Y are always in viewport pixels, so we must divide by zoom when translating.
function pageZoom(): number {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom)
  return isFinite(z) && z > 0 ? z : 1
}

// All runtime picker state in one place
const state = {
  pickerActive: false,
  multiSelectActive: false,
  modifierHeld: false,
  // --- pure data: persists across activate/deactivate ---
  lastMousePos: { x: 0, y: 0 },
  selectedElements: [] as Element[],
  selectedSet: new Set<Element>(),
  selectionRedoStack: [] as Element[],
  // --- DOM refs: always null when picker is inactive ---
  lastHighlighted: null as Element | null,
  hoverRoot: null as Element | null,
  badgeEls: [] as HTMLDivElement[],
  outlineStyleEl: null as HTMLStyleElement | null,
  highlightOverlayEl: null as HTMLDivElement | null,
  cursorStyleEl: null as HTMLStyleElement | null,
  cursorEl: null as HTMLDivElement | null,
  cursorMoveHandler: null as ((e: MouseEvent) => void) | null,
  cursorEnterHandler: null as (() => void) | null,
  cursorLeaveHandler: null as (() => void) | null,
  mousePosTracker: null as ((e: MouseEvent) => void) | null,
  domObserver: null as MutationObserver | null,
  scrollResizeHandler: null as (() => void) | null,
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
    .${CLASS_SELECTED} {
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

function positionHighlight(el: Element): void {
  if (!state.highlightOverlayEl) {
    const div = document.createElement('div')
    div.className = CLASS_OVERLAY
    document.documentElement.appendChild(div)
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

function clearHighlight(): void {
  if (state.highlightOverlayEl) state.highlightOverlayEl.style.display = 'none'
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
    const initOy = cursorFontSize() + settings.cursorOffsetY
    const initZ = pageZoom()
    el.style.transform = `translate(${(state.lastMousePos.x + settings.cursorOffsetX) / initZ}px,${(state.lastMousePos.y - initOy) / initZ}px)`
    document.documentElement.appendChild(el)
    state.cursorEl = el
    state.cursorMoveHandler = (e: MouseEvent) => {
      const oy = cursorFontSize() + settings.cursorOffsetY
      const z = pageZoom()
      state.cursorEl!.style.transform = `translate(${(e.clientX + settings.cursorOffsetX) / z}px,${(e.clientY - oy) / z}px)`
    }
    state.cursorLeaveHandler = () => { state.cursorEl!.style.visibility = 'hidden' }
    state.cursorEnterHandler = () => { state.cursorEl!.style.visibility = 'visible' }
    document.addEventListener('mousemove', state.cursorMoveHandler)
    document.addEventListener('mouseleave', state.cursorLeaveHandler)
    document.addEventListener('mouseenter', state.cursorEnterHandler)
  }
  state.cursorEl!.textContent = emoji
  state.cursorEl!.style.fontSize = `${cursorFontSize()}px`
}

function clearCursor(): void {
  state.cursorStyleEl?.remove()
  state.cursorStyleEl = null
  state.cursorEl?.remove()
  state.cursorEl = null
  if (state.cursorMoveHandler) {
    document.removeEventListener('mousemove', state.cursorMoveHandler)
    state.cursorMoveHandler = null
  }
  if (state.cursorLeaveHandler) {
    document.removeEventListener('mouseleave', state.cursorLeaveHandler)
    state.cursorLeaveHandler = null
  }
  if (state.cursorEnterHandler) {
    document.removeEventListener('mouseenter', state.cursorEnterHandler)
    state.cursorEnterHandler = null
  }
}

function syncCursor(): void {
  setCursor(state.modifierHeld ? settings.multiCursorEmoji : settings.cursorEmoji)
}

function addBadge(el: Element, index: number): void {
  const r = el.getBoundingClientRect()
  const badge = document.createElement('div')
  badge.className = CLASS_BADGE
  badge.textContent = String(index)
  if (settings.badgePulse) badge.classList.add(`${CLASS_BADGE}-pulse`)
  document.documentElement.appendChild(badge)
  const z = pageZoom()
  badge.style.top = `${(r.top + BADGE_INSET) / z}px`
  badge.style.left = `${(r.right - badge.offsetWidth - BADGE_INSET) / z}px`
  state.badgeEls.push(badge)
}

function clearBadges(): void {
  for (const b of state.badgeEls) b.remove()
  state.badgeEls.length = 0
}

function repositionOverlays(): void {
  const z = pageZoom()
  state.selectedElements.forEach((el, i) => {
    const badge = state.badgeEls[i]
    if (!badge) return
    const r = el.getBoundingClientRect()
    badge.style.top = `${(r.top + BADGE_INSET) / z}px`
    badge.style.left = `${(r.right - badge.offsetWidth - BADGE_INSET) / z}px`
  })
  if (state.lastHighlighted && state.highlightOverlayEl?.style.display !== 'none') {
    positionHighlight(state.lastHighlighted)
  }
}

function clearSelection(): void {
  for (const el of state.selectedElements) el.classList.remove(CLASS_SELECTED)
  state.selectedElements.length = 0
  state.selectedSet.clear()
  state.selectionRedoStack.length = 0
  clearBadges()
  state.multiSelectActive = false
}

function clearHover(): void {
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
  console.log(`${LOG} picker activated`)
  try {
    applyOutlineStyles()
    setCursor(settings.cursorEmoji)
    state.mousePosTracker = (e: MouseEvent) => { state.lastMousePos = { x: e.clientX, y: e.clientY } }

    document.addEventListener('mousemove', state.mousePosTracker, true)
    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)

    state.domObserver = new MutationObserver(() => {
      if (state.lastHighlighted && !document.contains(state.lastHighlighted)) {
        clearHighlight()
        state.lastHighlighted = null
        state.hoverRoot = null
      }
      if (state.selectedElements.some(el => !document.contains(el))) {
        const surviving = state.selectedElements.filter(el => document.contains(el))
        clearSelection()
        for (const el of surviving) {
          state.selectedElements.push(el)
          state.selectedSet.add(el)
          el.classList.add(CLASS_SELECTED)
          addBadge(el, state.selectedElements.length)
        }
        if (surviving.length > 0) state.multiSelectActive = true
      }
    })
    state.domObserver.observe(document.body, { childList: true, subtree: true })

    state.scrollResizeHandler = () => repositionOverlays()
    window.addEventListener('scroll', state.scrollResizeHandler, { capture: true, passive: true })
    window.addEventListener('resize', state.scrollResizeHandler)

    notifyPickerState(true)
  } catch (err) {
    console.error(`${LOG} activatePicker failed:`, err)
    deactivatePicker()
  }
}

function deactivatePicker(message?: string): void {
  if (!state.pickerActive) return
  state.pickerActive = false
  state.modifierHeld = false
  console.log(`${LOG} picker deactivated`)
  notifyPickerState(false)

  clearOutlineStyles()
  clearCursor()
  clearHover()
  clearSelection()

  if (state.mousePosTracker) {
    document.removeEventListener('mousemove', state.mousePosTracker, true)
    state.mousePosTracker = null
  }
  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  document.removeEventListener('keyup', onKeyUp, true)

  state.domObserver?.disconnect()
  state.domObserver = null

  if (state.scrollResizeHandler) {
    window.removeEventListener('scroll', state.scrollResizeHandler, { capture: true })
    window.removeEventListener('resize', state.scrollResizeHandler)
    state.scrollResizeHandler = null
  }

  if (message) showMessage(message)
}

function onMouseOver(e: MouseEvent): void {
  state.lastMousePos = { x: e.clientX, y: e.clientY }
  const target = e.target as Element
  if (target === document.body || target === document.documentElement) {
    clearHighlight()
    state.lastHighlighted = null
    state.hoverRoot = null
    return
  }
  state.hoverRoot = target
  state.lastHighlighted = target
  if (!state.multiSelectActive || state.modifierHeld) {
    positionHighlight(target)
  } else {
    clearHighlight()
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
  if (!state.selectedSet.has(el)) {
    state.selectedElements.push(el)
    state.selectedSet.add(el)
    el.classList.add(CLASS_SELECTED)
    addBadge(el, state.selectedElements.length)
    state.selectionRedoStack.length = 0
    if (!state.multiSelectActive) state.multiSelectActive = true
  }
  showMessage(`${state.selectedElements.length} selected — Enter to copy`)
}

function undoSelection(): void {
  const removed = state.selectedElements.pop()!
  state.selectedSet.delete(removed)
  removed.classList.remove(CLASS_SELECTED)
  state.badgeEls.pop()?.remove()
  state.selectionRedoStack.push(removed)
  if (state.selectedElements.length === 0) {
    state.multiSelectActive = false
    syncCursor()
    showMessage('Selection cleared')
  } else {
    showMessage(`${state.selectedElements.length} selected — Enter to copy`)
  }
}

function redoSelection(): void {
  const el = state.selectionRedoStack.pop()!
  state.selectedElements.push(el)
  state.selectedSet.add(el)
  el.classList.add(CLASS_SELECTED)
  addBadge(el, state.selectedElements.length)
  if (!state.multiSelectActive) state.multiSelectActive = true
  showMessage(`${state.selectedElements.length} selected — Enter to copy`)
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === PROP_TO_KEY[keyMap.multiSelect]) {
    state.modifierHeld = true
    syncCursor()
    if (state.lastHighlighted) positionHighlight(state.lastHighlighted)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopImmediatePropagation()
    deactivatePicker('Canceled')
  } else if ((e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft') && state.selectedElements.length > 0) {
    e.preventDefault()
    e.stopImmediatePropagation()
    undoSelection()
  } else if (e.key === 'ArrowRight' && state.selectionRedoStack.length > 0) {
    e.preventDefault()
    e.stopImmediatePropagation()
    redoSelection()
  } else if (e.key === 'ArrowUp' && state.lastHighlighted && (!state.multiSelectActive || state.modifierHeld)) {
    e.preventDefault()
    e.stopImmediatePropagation()
    const parent = state.lastHighlighted.parentElement
    if (parent && parent !== document.documentElement) {
      state.lastHighlighted = parent
      positionHighlight(parent)
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
      positionHighlight(el)
    }
  } else if (e.key === 'Enter' && (state.selectedElements.length > 0 || state.lastHighlighted)) {
    e.preventDefault()
    e.stopImmediatePropagation()
    const elements = state.selectedElements.length > 0 ? state.selectedElements : [state.lastHighlighted!]
    const md = elements.map(el => convert(el.outerHTML)).join('\n')
    console.log(`${LOG} committing`, elements.length, 'elements — md length:', md.length)
    navigator.clipboard.writeText(md)
      .then(() => { console.log(`${LOG} clipboard write ok`); deactivatePicker('📝 Copied') })
      .catch((err: Error) => { console.error(`${LOG} clipboard write failed:`, err.message); deactivatePicker('Error: ' + err.message) })
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === PROP_TO_KEY[keyMap.multiSelect]) {
    state.modifierHeld = false
    syncCursor()
    if (state.multiSelectActive) clearHighlight()
  }
}

function showMessage(text: string): void {
  const el = document.createElement('div')
  el.className = CLASS_FLASH
  el.textContent = text
  const initZ = pageZoom()
  el.style.left = `${state.lastMousePos.x / initZ}px`
  el.style.top = `${state.lastMousePos.y / initZ}px`
  el.style.transform = 'translate(-50%, -50%)'
  el.style.animationName = 'none'
  document.documentElement.appendChild(el)

  setTimeout(() => {
    const r = el.getBoundingClientRect()
    const z = pageZoom()
    const hw = r.width / 2, hh = r.height / 2
    const cx = Math.max(hw, Math.min(window.innerWidth  - hw, r.left + hw))
    const cy = Math.max(hh, Math.min(window.innerHeight - hh, r.top  + hh))
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
