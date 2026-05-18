console.log('[web-md] content script loaded')

let pickerActive = false
let lastHighlighted = null
const turndown = new TurndownService()

function activatePicker() {
  if (pickerActive) return
  pickerActive = true
  console.log('[web-md] picker activated')

  document.addEventListener('mouseover', onMouseOver)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
}

function deactivatePicker() {
  if (!pickerActive) return
  pickerActive = false
  console.log('[web-md] picker deactivated')

  if (lastHighlighted) {
    lastHighlighted.classList.remove('web-md-highlight')
    lastHighlighted = null
  }

  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

function onMouseOver(e) {
  if (lastHighlighted) lastHighlighted.classList.remove('web-md-highlight')
  if (e.target === document.body || e.target === document.documentElement) return
  lastHighlighted = e.target
  lastHighlighted.classList.add('web-md-highlight')
}

function onClick(e) {
  e.preventDefault()
  e.stopPropagation()

  const el = e.target
  if (el === document.body || el === document.documentElement) {
    deactivatePicker()
    return
  }

  const html = el.outerHTML
  const md = turndown.turndown(html)
  console.log('[web-md] captured element:', el.tagName, '— md length:', md.length)

  navigator.clipboard.writeText(md)
    .then(() => { console.log('[web-md] clipboard write ok'); showFlash('Copied!') })
    .catch(err => { console.error('[web-md] clipboard write failed:', err.message); showFlash('Error: ' + err.message) })

  deactivatePicker()
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    deactivatePicker()
  }
}

function showFlash(text) {
  const el = document.createElement('div')
  el.className = 'web-md-flash'
  el.textContent = text
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1500)
}

api.runtime.onMessage.addListener((msg) => {
  console.log('[web-md] message received:', msg)
  if (msg.action === 'activate') activatePicker()
})
