const browserAPI = window.browser || window.chrome

let pickerActive = false
let lastHighlighted = null
let injectedStyle = null
const turndown = new TurndownService()

function activatePicker() {
  if (pickerActive) return
  pickerActive = true

  injectedStyle = document.createElement('style')
  injectedStyle.textContent = `
    .web-md-highlight {
      outline: 2px solid #f90 !important;
      cursor: crosshair !important;
    }
  `
  document.head.appendChild(injectedStyle)

  document.addEventListener('mouseover', onMouseOver)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
}

function deactivatePicker() {
  if (!pickerActive) return
  pickerActive = false

  if (lastHighlighted) {
    lastHighlighted.classList.remove('web-md-highlight')
    lastHighlighted = null
  }
  if (injectedStyle) {
    injectedStyle.remove()
    injectedStyle = null
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

  navigator.clipboard.writeText(md)
    .then(() => showFlash('Copied!'))
    .catch(err => showFlash('Error: ' + err.message))

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
  el.textContent = text
  el.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0,0,0,0.8);
    color: #fff;
    padding: 8px 14px;
    border-radius: 6px;
    font: 13px/1.4 system-ui, sans-serif;
    z-index: 2147483647;
    pointer-events: none;
  `
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1500)
}

browserAPI.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'activate') activatePicker()
})
