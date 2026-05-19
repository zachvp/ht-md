console.log('[web-md] content script loaded')

let pickerActive = false
let lastHighlighted: Element | null = null
let lastMousePos = { x: 0, y: 0 }
const selectedElements: Element[] = []
const selectedSet = new Set<Element>()

const turndown = new TurndownService()
turndown.remove(['style', 'script', 'noscript'])

function activatePicker(): void {
  if (pickerActive) return
  pickerActive = true
  console.log('[web-md] picker activated')

  document.addEventListener('mouseover', onMouseOver)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
}

function deactivatePicker(): void {
  if (!pickerActive) return
  pickerActive = false
  console.log('[web-md] picker deactivated')

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

  if (e.shiftKey) {
    if (!selectedSet.has(el)) {
      selectedElements.push(el)
      selectedSet.add(el)
      el.classList.add('web-md-selected')
    }
    showFlash(`${selectedElements.length} selected — Enter to copy`, e.clientX, e.clientY)
    return
  }

  const html = el.outerHTML
  const md = turndown.turndown(html)
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
    const md = selectedElements.map(el => turndown.turndown(el.outerHTML)).join('\n')
    console.log('[web-md] committing', selectedElements.length, 'elements — md length:', md.length)
    navigator.clipboard.writeText(md)
      .then(() => { console.log('[web-md] clipboard write ok'); showFlash('📝 Copied', lastMousePos.x, lastMousePos.y) })
      .catch((err: Error) => { console.error('[web-md] clipboard write failed:', err.message); showFlash('Error: ' + err.message, lastMousePos.x, lastMousePos.y) })
    deactivatePicker()
  }
}

function showFlash(text: string, x: number, y: number): void {
  const el = document.createElement('div')
  el.className = 'web-md-flash'
  el.textContent = text
  el.style.left = '0'
  el.style.top = '0'
  document.body.appendChild(el)
  const pad = 8
  const w = el.offsetWidth
  const h = el.offsetHeight
  el.style.left = `${Math.min(Math.max(x - w / 2, pad), window.innerWidth - w - pad)}px`
  el.style.top = `${Math.min(Math.max(y + 12, pad), window.innerHeight - h - pad)}px`
  setTimeout(() => el.remove(), 1500)
}

chrome.runtime.onMessage.addListener((msg: { action: string }) => {
  console.log('[web-md] message received:', msg)
  if (msg.action === 'activate') activatePicker()
})
