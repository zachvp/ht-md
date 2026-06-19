console.log('[web-md] content script loaded')

let pickerActive = false
let lastHighlighted: Element | null = null
let lastMousePos = { x: 0, y: 0 }
let flashEl: HTMLDivElement | null = null
let flashMoveHandler: ((e: MouseEvent) => void) | null = null
const selectedElements: Element[] = []
const selectedSet = new Set<Element>()

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

let includeSvg = false
let cursorSize = 32
chrome.storage.sync.get({ includeSvg: false, cursorSize: 32 }).then(({ includeSvg: svg, cursorSize: size }) => {
  includeSvg = svg as boolean
  cursorSize = size as number
})
chrome.storage.onChanged.addListener(changes => {
  if (changes.includeSvg) includeSvg = changes.includeSvg.newValue
  if (changes.cursorSize) cursorSize = changes.cursorSize.newValue
})

function convert(html: string): string {
  return (includeSvg ? turndown : turndownStripped).turndown(html)
}

function buildCursor(emoji: string, size = 32): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.font = `${size * 0.85}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2)
  return canvas.toDataURL()
}

let cursorStyleEl: HTMLStyleElement | null = null

function setCursor(emoji: string): void {
  if (!cursorStyleEl) {
    cursorStyleEl = document.createElement('style')
    document.head.appendChild(cursorStyleEl)
  }
  const url = buildCursor(emoji, cursorSize)
  const hx = Math.round(cursorSize / 2)
  const hy = Math.round(cursorSize / 16)
  cursorStyleEl.textContent = `* { cursor: url(${url}) ${hx} ${hy}, auto !important; }`
}

function clearCursor(): void {
  cursorStyleEl?.remove()
  cursorStyleEl = null
}

function activatePicker(): void {
  if (pickerActive) return
  pickerActive = true
  console.log('[web-md] picker activated')

  setCursor('👆')

  document.addEventListener('mouseover', onMouseOver)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
}

function deactivatePicker(): void {
  if (!pickerActive) return
  pickerActive = false
  console.log('[web-md] picker deactivated')

  clearCursor()

  lastHighlighted?.classList.remove('web-md-highlight')
  lastHighlighted = null

  for (const el of selectedElements) el.classList.remove('web-md-selected')
  selectedElements.length = 0
  selectedSet.clear()

  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

function onMouseOver(e: MouseEvent): void {
  lastMousePos = { x: e.clientX, y: e.clientY }
  lastHighlighted?.classList.remove('web-md-highlight')
  const target = e.target as Element
  if (target === document.body || target === document.documentElement) return
  lastHighlighted = target
  lastHighlighted.classList.add('web-md-highlight')
}

function onClick(e: MouseEvent): void {
  e.preventDefault()
  e.stopPropagation()

  const el = e.target as Element
  if (el === document.body || el === document.documentElement) {
    deactivatePicker()
    return
  }

  if (e.metaKey) {
    if (!selectedSet.has(el)) {
      selectedElements.push(el)
      selectedSet.add(el)
      el.classList.add('web-md-selected')
    }
    showFlash(`${selectedElements.length} selected — Enter to copy`, e.clientX, e.clientY)
    return
  }

  const html = el.outerHTML
  const md = convert(html)
  console.log('[web-md] captured element:', el.tagName, '— md length:', md.length)

  navigator.clipboard.writeText(md)
    .then(() => { console.log('[web-md] clipboard write ok'); showFlash('📝 Copied', e.clientX, e.clientY) })
    .catch((err: Error) => { console.error('[web-md] clipboard write failed:', err.message); showFlash('Error: ' + err.message, e.clientX, e.clientY) })

  deactivatePicker()
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    deactivatePicker()
  } else if (e.key === 'Enter' && selectedElements.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    const md = selectedElements.map(el => convert(el.outerHTML)).join('\n')
    console.log('[web-md] committing', selectedElements.length, 'elements — md length:', md.length)
    navigator.clipboard.writeText(md)
      .then(() => { console.log('[web-md] clipboard write ok'); showFlash('📝 Copied', lastMousePos.x, lastMousePos.y) })
      .catch((err: Error) => { console.error('[web-md] clipboard write failed:', err.message); showFlash('Error: ' + err.message, lastMousePos.x, lastMousePos.y) })
    deactivatePicker()
  }
}

function showFlash(text: string, x: number, y: number): void {
  if (flashEl) {
    flashEl.remove()
    if (flashMoveHandler) document.removeEventListener('mousemove', flashMoveHandler)
  }

  const el = document.createElement('div') as HTMLDivElement
  el.className = 'web-md-flash'
  el.textContent = text
  el.style.left = '0'
  el.style.top = '0'
  document.body.appendChild(el)

  const pad = 8
  const w = el.offsetWidth
  const h = el.offsetHeight
  function position(cx: number, cy: number): void {
    el.style.left = `${Math.min(Math.max(cx - w / 2, pad), window.innerWidth - w - pad)}px`
    el.style.top = `${Math.min(Math.max(cy + 12, pad), window.innerHeight - h - pad)}px`
  }

  position(x, y)
  flashEl = el
  flashMoveHandler = (e: MouseEvent) => position(e.clientX, e.clientY)
  document.addEventListener('mousemove', flashMoveHandler)

  setTimeout(() => {
    el.remove()
    document.removeEventListener('mousemove', flashMoveHandler!)
    if (flashEl === el) { flashEl = null; flashMoveHandler = null }
  }, 1500)
}

chrome.runtime.onMessage.addListener((msg: { action: string }) => {
  console.log('[web-md] message received:', msg)
  if (msg.action === 'activate') activatePicker()
})
