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
  cursorPosEl: null as HTMLDivElement | null,   // position wrapper (translate)
  cursorEl: null as HTMLDivElement | null,      // content div (emoji + scale animation)
  cursorMoveHandler: null as ((e: MouseEvent) => void) | null,
  lastTrackedEl: null as Element | null,        // element used for facing, persists within facingBounds
}

// User-configurable settings, kept in sync with chrome.storage.sync
const settings = {
  includeSvg: false,
  cursorSize: 32,
  outlineColor: '#ff9900',
  outlineWidth: 2,
  insetWidth: 2,
  cursorEmoji: '📌',
  multiCursorEmoji: '📝',
  flashFontSize: 13,
  flashFontColor: '#ffffff',
  flashPause: 400,
  flashDuration: 1500,
  cursorOffsetX: -6,
  cursorOffsetY: -6,
  facingX: 0,
  facingY: -1,
  facingBounds: 0,
}

const turndown = new TurndownService()
turndown.remove(['style', 'script', 'noscript'])

const turndownStripped = new TurndownService()
turndownStripped.remove(['style', 'script', 'noscript'])
turndownStripped.addRule('stripSvgElement', {
  filter: ['svg'],
  replacement: () => '[SVG]',
})
turndownStripped.addRule('stripSvgDataUri', {
  filter: (node: HTMLElement) =>
    node.nodeName === 'IMG' &&
    node.getAttribute('src')?.startsWith('data:image/svg+xml') === true,
  replacement: (_content: string, node: Node) => {
    const alt = (node as HTMLElement).getAttribute('alt')
    return alt ? `[SVG image: ${alt}]` : '[SVG image]'
  },
})

chrome.storage.sync.get({
  includeSvg: false, cursorSize: 32, outlineColor: '#ff9900', outlineWidth: 2, insetWidth: 2,
  cursorEmoji: '📌', multiCursorEmoji: '📝', flashFontSize: 13, flashFontColor: '#ffffff', flashPause: 400, flashDuration: 1500, cursorOffsetX: -6, cursorOffsetY: -6, facingX: 0, facingY: -1, facingBounds: 0,
}).then(({ includeSvg, cursorSize, outlineColor, outlineWidth, insetWidth, cursorEmoji, multiCursorEmoji, flashFontSize, flashFontColor, flashPause, flashDuration, cursorOffsetX, cursorOffsetY, facingX, facingY, facingBounds }) => {
  settings.includeSvg = includeSvg as boolean
  settings.cursorSize = cursorSize as number
  settings.outlineColor = outlineColor as string
  settings.outlineWidth = outlineWidth as number
  settings.insetWidth = insetWidth as number
  settings.cursorEmoji = cursorEmoji as string
  settings.multiCursorEmoji = multiCursorEmoji as string
  settings.flashFontSize = flashFontSize as number
  settings.flashFontColor = flashFontColor as string
  settings.flashPause = flashPause as number
  settings.flashDuration = flashDuration as number
  settings.cursorOffsetX = cursorOffsetX as number
  settings.cursorOffsetY = cursorOffsetY as number
  settings.facingX = facingX as number
  settings.facingY = facingY as number
  settings.facingBounds = facingBounds as number
})

chrome.storage.onChanged.addListener(changes => {
  if (changes.includeSvg) settings.includeSvg = changes.includeSvg.newValue
  if (changes.cursorSize) settings.cursorSize = changes.cursorSize.newValue
  if (changes.outlineColor) settings.outlineColor = changes.outlineColor.newValue
  if (changes.outlineWidth) settings.outlineWidth = changes.outlineWidth.newValue
  if (changes.insetWidth) settings.insetWidth = changes.insetWidth.newValue
  if (changes.cursorEmoji) settings.cursorEmoji = changes.cursorEmoji.newValue
  if (changes.multiCursorEmoji) settings.multiCursorEmoji = changes.multiCursorEmoji.newValue
  if (changes.flashFontSize) settings.flashFontSize = changes.flashFontSize.newValue
  if (changes.flashFontColor) settings.flashFontColor = changes.flashFontColor.newValue
  if (changes.flashPause) settings.flashPause = changes.flashPause.newValue
  if (changes.flashDuration) settings.flashDuration = changes.flashDuration.newValue
  if (changes.cursorOffsetX) settings.cursorOffsetX = changes.cursorOffsetX.newValue
  if (changes.cursorOffsetY) settings.cursorOffsetY = changes.cursorOffsetY.newValue
  if (changes.facingX) settings.facingX = changes.facingX.newValue
  if (changes.facingY) settings.facingY = changes.facingY.newValue
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

function updateCursorRotation(el: Element): void {
  if (!state.cursorEl) return
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const dx = cx - state.lastMousePos.x
  const dy = cy - state.lastMousePos.y
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag < 1) return
  const targetAngle = Math.atan2(dy / mag, dx / mag)
  const naturalAngle = Math.atan2(settings.facingY, settings.facingX)
  state.cursorEl.style.rotate = `${targetAngle - naturalAngle}rad`
}

function applyOutlineStyles(): void {
  if (!state.outlineStyleEl) {
    state.outlineStyleEl = document.createElement('style')
    state.outlineStyleEl.className = 'darkreader darkreader--sync'
    document.head.appendChild(state.outlineStyleEl)
  }
  state.outlineStyleEl.textContent = `
    .web-md-selected {
      outline: ${settings.outlineWidth}px solid #3399ff !important;
      outline-offset: 1px !important;
      box-shadow: inset 0 0 0 ${settings.insetWidth}px rgba(51, 153, 255, 0.35) !important;
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
    document.body.appendChild(div)
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
  updateCursorRotation(el)
}

function clearHighlight(): void {
  if (state.highlightOverlayEl) state.highlightOverlayEl.style.display = 'none'
}

function setCursor(emoji: string): void {
  if (!state.cursorStyleEl) {
    state.cursorStyleEl = document.createElement('style')
    state.cursorStyleEl.className = 'darkreader darkreader--sync'
    state.cursorStyleEl.textContent = '* { cursor: none !important; }'
    document.head.appendChild(state.cursorStyleEl)
  }
  if (!state.cursorPosEl) {
    // Outer div: handles translate position only
    const pos = document.createElement('div')
    const initOy = Math.round(settings.cursorSize * 0.875) + settings.cursorOffsetY
    const sz = settings.cursorSize
    const initX = Math.max(0, Math.min(window.innerWidth - sz, state.lastMousePos.x + settings.cursorOffsetX))
    const initY = Math.max(0, Math.min(window.innerHeight - sz, state.lastMousePos.y - initOy))
    pos.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;'
    pos.style.transform = `translate(${initX}px,${initY}px)`

    // Inner div: emoji content + scale-up animation (scale/rotate as independent CSS properties)
    const inner = document.createElement('div')
    inner.style.cssText = 'display:inline-block;user-select:none;line-height:1;scale:0;'
    pos.appendChild(inner)
    document.body.appendChild(pos)
    state.cursorPosEl = pos
    state.cursorEl = inner

    // Animate scale 0 → 1 with a spring overshoot; rotate is independent (no transition)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (inner.isConnected) {
        inner.style.transition = 'scale 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
        inner.style.scale = '1'
      }
    }))

    state.cursorMoveHandler = (e: MouseEvent) => {
      const oy = Math.round(settings.cursorSize * 0.875) + settings.cursorOffsetY
      const sz = settings.cursorSize
      const x = Math.max(0, Math.min(window.innerWidth - sz, e.clientX + settings.cursorOffsetX))
      const y = Math.max(0, Math.min(window.innerHeight - sz, e.clientY - oy))
      state.cursorPosEl!.style.transform = `translate(${x}px,${y}px)`
      if (state.lastHighlighted) updateCursorRotation(state.lastHighlighted)
    }
    document.addEventListener('mousemove', state.cursorMoveHandler)
  }
  const fs = Math.round(settings.cursorSize * 0.875)
  state.cursorEl!.textContent = emoji
  state.cursorEl!.style.fontSize = `${fs}px`
}

function clearCursor(): void {
  state.cursorStyleEl?.remove()
  state.cursorStyleEl = null
  state.cursorPosEl?.remove()
  state.cursorPosEl = null
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
  document.body.appendChild(badge)
  badge.style.top = `${r.top + 4}px`
  badge.style.left = `${r.right - badge.offsetWidth - 4}px`
  state.badgeEls.push(badge)
}

function clearBadges(): void {
  for (const b of state.badgeEls) b.remove()
  state.badgeEls.length = 0
}

function notifyPickerState(active: boolean): void {
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
  el.style.left = `${state.lastMousePos.x}px`
  el.style.top = `${state.lastMousePos.y}px`
  document.body.appendChild(el)
  setTimeout(() => el.remove(), settings.flashPause + settings.flashDuration)
}

chrome.runtime.onMessage.addListener((msg: { action: string }) => {
  console.log('[web-md] message received:', msg)
  if (msg.action === 'toggle' || msg.action === 'activate') {
    if (state.pickerActive) deactivatePicker()
    else activatePicker()
  }
})
