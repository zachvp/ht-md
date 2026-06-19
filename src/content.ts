import { SETTINGS_DEFAULTS, Settings } from './lib/settings'

console.log('[web-md] content script loaded')

// All runtime picker state in one place
const state = {
  pickerActive: false,
  lastHighlighted: null as Element | null,
  lastMousePos: { x: 0, y: 0 },
  flashContainerEl: null as HTMLDivElement | null,
  selectedElements: [] as Element[],
  selectedSet: new Set<Element>(),
  badgeEls: [] as HTMLDivElement[],
  outlineStyleEl: null as HTMLStyleElement | null,
  highlightOverlayEl: null as HTMLDivElement | null,
  cursorStyleEl: null as HTMLStyleElement | null,
  cursorEl: null as HTMLDivElement | null,
  cursorMoveHandler: null as ((e: MouseEvent) => void) | null,
}

// User-configurable settings, kept in sync with chrome.storage.sync
const settings: Settings = { ...SETTINGS_DEFAULTS }

function makeTurndown(stripSvg: boolean): TurndownService {
  const td = new TurndownService()
  td.remove(['style', 'script', 'noscript'])
  if (stripSvg) {
    td.addRule('stripSvgElement', {
      filter: ['svg'],
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

chrome.storage.sync.get(SETTINGS_DEFAULTS).then(stored => {
  Object.assign(settings, stored)
})

chrome.storage.onChanged.addListener(changes => {
  for (const key of Object.keys(settings) as (keyof Settings)[]) {
    if (key in changes) (settings as Record<string, unknown>)[key] = changes[key].newValue
  }
  if (state.pickerActive && (changes.outlineColor || changes.outlineWidth || changes.insetWidth)) {
    applyOutlineStyles()
  }
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
    state.outlineStyleEl.className = 'darkreader darkreader--sync'
    document.head.appendChild(state.outlineStyleEl)
  }
  state.outlineStyleEl.textContent = `
    .web-md-selected {
      outline: ${settings.outlineWidth}px solid ${settings.outlineColor} !important;
      outline-offset: 1px !important;
      box-shadow: inset 0 0 0 ${settings.insetWidth}px ${withAlpha(settings.outlineColor, 0.35)} !important;
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
    div.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;box-sizing:border-box;'
    document.documentElement.appendChild(div)
    state.highlightOverlayEl = div
  }
  const r = el.getBoundingClientRect()
  const ov = state.highlightOverlayEl
  ov.style.top = `${r.top}px`
  ov.style.left = `${r.left}px`
  ov.style.width = `${r.width}px`
  ov.style.height = `${r.height}px`
  ov.style.outline = `${settings.outlineWidth}px solid ${settings.outlineColor}`
  ov.style.outlineOffset = '1px'
  ov.style.boxShadow = `inset 0 0 0 ${settings.insetWidth}px ${withAlpha(settings.outlineColor, 0.35)}`
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
    state.cursorStyleEl.className = 'darkreader darkreader--sync'
    state.cursorStyleEl.textContent = '* { cursor: none !important; }'
    document.head.appendChild(state.cursorStyleEl)
  }
  if (!state.cursorEl) {
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;user-select:none;line-height:1;'
    const initOy = cursorFontSize() + settings.cursorOffsetY
    el.style.transform = `translate(${state.lastMousePos.x + settings.cursorOffsetX}px,${state.lastMousePos.y - initOy}px)`
    document.documentElement.appendChild(el)
    state.cursorEl = el
    state.cursorMoveHandler = (e: MouseEvent) => {
      const oy = cursorFontSize() + settings.cursorOffsetY
      state.cursorEl!.style.transform = `translate(${e.clientX + settings.cursorOffsetX}px,${e.clientY - oy}px)`
    }
    document.addEventListener('mousemove', state.cursorMoveHandler)
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
}

function addBadge(el: Element, index: number): void {
  const r = el.getBoundingClientRect()
  const badge = document.createElement('div')
  badge.className = 'web-md-badge'
  badge.textContent = String(index)
  document.documentElement.appendChild(badge)
  badge.style.top = `${r.top + 4}px`
  badge.style.left = `${r.right - badge.offsetWidth - 4}px`
  state.badgeEls.push(badge)
}

function clearBadges(): void {
  for (const b of state.badgeEls) b.remove()
  state.badgeEls.length = 0
}

function notifyPickerState(active: boolean): void {
  if (!chrome.runtime?.id) return
  chrome.runtime.sendMessage({ action: 'pickerState', active }).catch(() => {})
}

function activatePicker(): void {
  if (state.pickerActive) return
  state.pickerActive = true
  console.log('[web-md] picker activated')
  try {
    applyOutlineStyles()
    setCursor(settings.cursorEmoji)
    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
    notifyPickerState(true)
  } catch (err) {
    console.error('[web-md] activatePicker failed:', err)
    deactivatePicker()
  }
}

function deactivatePicker(): void {
  if (!state.pickerActive) return
  state.pickerActive = false
  console.log('[web-md] picker deactivated')
  notifyPickerState(false)

  clearOutlineStyles()
  clearCursor()

  state.highlightOverlayEl?.remove()
  state.highlightOverlayEl = null
  state.lastHighlighted = null

  for (const el of state.selectedElements) el.classList.remove('web-md-selected')
  state.selectedElements.length = 0
  state.selectedSet.clear()
  clearBadges()

  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

function onMouseOver(e: MouseEvent): void {
  state.lastMousePos = { x: e.clientX, y: e.clientY }
  const target = e.target as Element
  if (target === document.body || target === document.documentElement) {
    clearHighlight()
    state.lastHighlighted = null
    return
  }
  state.lastHighlighted = target
  positionHighlight(target)
}

function onClick(e: MouseEvent): void {
  if (!e.isTrusted) return
  e.preventDefault()
  e.stopPropagation()

  const el = e.target as Element
  if (el === document.body || el === document.documentElement) {
    deactivatePicker()
    return
  }

  if (e.metaKey) {
    if (!state.selectedSet.has(el)) {
      state.selectedElements.push(el)
      state.selectedSet.add(el)
      el.classList.add('web-md-selected')
      addBadge(el, state.selectedElements.length)
      if (state.selectedElements.length === 1) setCursor(settings.multiCursorEmoji)
    }
    showFlash(`${state.selectedElements.length} selected — Enter to copy`)
    return
  }

  const html = el.outerHTML
  const md = convert(html)
  console.log('[web-md] captured element:', el.tagName, '— md length:', md.length)

  navigator.clipboard.writeText(md)
    .then(() => { console.log('[web-md] clipboard write ok'); showFlash('📝 Copied') })
    .catch((err: Error) => { console.error('[web-md] clipboard write failed:', err.message); showFlash('Error: ' + err.message) })

  deactivatePicker()
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopImmediatePropagation()
    deactivatePicker()
  } else if (e.key === 'Enter' && state.selectedElements.length > 0) {
    e.preventDefault()
    e.stopImmediatePropagation()
    const md = state.selectedElements.map(el => convert(el.outerHTML)).join('\n')
    console.log('[web-md] committing', state.selectedElements.length, 'elements — md length:', md.length)
    navigator.clipboard.writeText(md)
      .then(() => { console.log('[web-md] clipboard write ok'); showFlash('📝 Copied') })
      .catch((err: Error) => { console.error('[web-md] clipboard write failed:', err.message); showFlash('Error: ' + err.message) })
    deactivatePicker()
  }
}

function showFlash(text: string): void {
  const el = document.createElement('div')
  el.className = 'web-md-flash'
  el.textContent = text
  el.style.fontSize = `${settings.flashFontSize}px`
  el.style.color = settings.flashFontColor
  el.style.animationDelay = `${settings.flashPause}ms`
  el.style.animationDuration = `${settings.flashDuration}ms`
  el.style.position = 'fixed'
  el.style.left = `${state.lastMousePos.x}px`
  el.style.top = `${state.lastMousePos.y}px`
  document.documentElement.appendChild(el)
  setTimeout(() => el.remove(), settings.flashPause + settings.flashDuration)
}

chrome.runtime.onMessage.addListener((msg: { action: string }) => {
  console.log('[web-md] message received:', msg)
  if (msg.action === 'toggle' || msg.action === 'activate') {
    if (state.pickerActive) deactivatePicker()
    else activatePicker()
  }
})
