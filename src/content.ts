import { api } from './browser.js'

console.log('[web-md] content script loaded')

let pickerActive = false
let lastHighlighted: Element | null = null
const turndown = new TurndownService()

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

  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

function onMouseOver(e: MouseEvent): void {
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

  const html = el.outerHTML
  const md = turndown.turndown(html)
  console.log('[web-md] captured element:', el.tagName, '— md length:', md.length)

  navigator.clipboard.writeText(md)
    .then(() => { console.log('[web-md] clipboard write ok'); showFlash('Copied!') })
    .catch((err: Error) => { console.error('[web-md] clipboard write failed:', err.message); showFlash('Error: ' + err.message) })

  deactivatePicker()
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    deactivatePicker()
  }
}

function showFlash(text: string): void {
  const el = document.createElement('div')
  el.className = 'web-md-flash'
  el.textContent = text
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1500)
}

api.runtime.onMessage.addListener((msg: { action: string }) => {
  console.log('[web-md] message received:', msg)
  if (msg.action === 'activate') activatePicker()
})
