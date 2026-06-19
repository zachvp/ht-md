const checkbox = document.getElementById('includeSvg') as HTMLInputElement
const cursorEmojiBtn = document.getElementById('cursorEmojiBtn') as HTMLButtonElement
const multiCursorEmojiBtn = document.getElementById('multiCursorEmojiBtn') as HTMLButtonElement
const cursorSizeInput = document.getElementById('cursorSize') as HTMLInputElement
const facingXInput = document.getElementById('facingX') as HTMLInputElement
const facingYInput = document.getElementById('facingY') as HTMLInputElement
const offsetPlane = document.getElementById('offsetPlane') as HTMLDivElement
const offsetDot = document.getElementById('offsetDot') as HTMLDivElement
const offsetCoords = document.getElementById('offsetCoords') as HTMLSpanElement
const outlineColorInput = document.getElementById('outlineColor') as HTMLInputElement
const outlineColorSwatch = document.getElementById('outlineColorSwatch') as HTMLSpanElement
const outlineWidthInput = document.getElementById('outlineWidth') as HTMLInputElement
const insetWidthInput = document.getElementById('insetWidth') as HTMLInputElement
const flashFontSizeInput = document.getElementById('flashFontSize') as HTMLInputElement
const flashPauseInput = document.getElementById('flashPause') as HTMLInputElement
const flashDurationInput = document.getElementById('flashDuration') as HTMLInputElement
const flashFontColorInput = document.getElementById('flashFontColor') as HTMLInputElement
const flashFontColorSwatch = document.getElementById('flashFontColorSwatch') as HTMLSpanElement
const optionsFontSizeInput = document.getElementById('optionsFontSize') as HTMLInputElement
const optionsFontColorInput = document.getElementById('optionsFontColor') as HTMLInputElement
const optionsFontColorSwatch = document.getElementById('optionsFontColorSwatch') as HTMLSpanElement
const optionsBgColorInput = document.getElementById('optionsBgColor') as HTMLInputElement
const optionsBgColorSwatch = document.getElementById('optionsBgColorSwatch') as HTMLSpanElement
const status = document.getElementById('status') as HTMLParagraphElement

import 'emoji-picker-element'
import { SETTINGS_DEFAULTS } from './lib/settings'

function makeEmojiPicker(btn: HTMLButtonElement, onChange: (emoji: string) => void): void {
  let wrap: HTMLDivElement | null = null

  function close(): void {
    wrap?.remove()
    wrap = null
    document.removeEventListener('click', onOutside)
  }

  function onOutside(e: MouseEvent): void {
    if (!btn.parentElement?.contains(e.target as Node)) close()
  }

  btn.addEventListener('click', () => {
    if (wrap) { close(); return }
    wrap = document.createElement('div')
    wrap.className = 'emoji-picker-panel'
    const picker = document.createElement('emoji-picker') as HTMLElement
    picker.setAttribute('class', 'light')
    wrap.appendChild(picker)
    btn.parentElement!.appendChild(wrap)
    picker.addEventListener('emoji-click', (e: Event) => {
      const emoji = (e as CustomEvent).detail?.unicode as string
      if (!emoji) return
      btn.textContent = emoji
      onChange(emoji)
      close()
    })
    setTimeout(() => document.addEventListener('click', onOutside), 0)
  })
}

function showSaved(): void {
  status.textContent = 'Saved'
  setTimeout(() => { status.textContent = '' }, 1500)
}

function syncSwatch(input: HTMLInputElement, swatch: HTMLElement): void {
  swatch.style.background = input.value
}

function wireColor(
  input: HTMLInputElement,
  swatch: HTMLElement,
  storageKey: string,
  onInput?: () => void,
): void {
  input.addEventListener('input', () => { syncSwatch(input, swatch); onInput?.() })
  input.addEventListener('change', () => chrome.storage.sync.set({ [storageKey]: input.value }).then(showSaved))
}

// 2D offset plane
let planeDragging = false
let curOffsetX = 0
let curOffsetY = 0

function moveDot(x: number, y: number): void {
  curOffsetX = Math.max(-10, Math.min(10, Math.round(x)))
  curOffsetY = Math.max(-10, Math.min(10, Math.round(y)))
  offsetDot.style.left = `${(curOffsetX + 10) / 20 * 100}%`
  offsetDot.style.top = `${(10 - curOffsetY) / 20 * 100}%`
  offsetCoords.textContent = `${curOffsetX}, ${curOffsetY}`
}

function planeVals(e: MouseEvent): { x: number; y: number } {
  const r = offsetPlane.getBoundingClientRect()
  return {
    x: (e.clientX - r.left) / r.width * 20 - 10,
    y: 10 - (e.clientY - r.top) / r.height * 20,
  }
}

offsetPlane.addEventListener('mousedown', (e) => {
  planeDragging = true
  const { x, y } = planeVals(e)
  moveDot(x, y)
  e.preventDefault()
})
document.addEventListener('mousemove', (e) => {
  if (!planeDragging) return
  moveDot(...Object.values(planeVals(e)) as [number, number])
})
document.addEventListener('mouseup', () => {
  if (!planeDragging) return
  planeDragging = false
  chrome.storage.sync.set({ cursorOffsetX: curOffsetX, cursorOffsetY: curOffsetY }).then(showSaved)
})

// Load
chrome.storage.sync.get(SETTINGS_DEFAULTS).then(({ includeSvg, cursorEmoji, multiCursorEmoji, cursorSize, cursorOffsetX, cursorOffsetY, facingX, facingY,
          outlineColor, outlineWidth, insetWidth, flashFontSize, flashFontColor, flashPause, flashDuration,
          optionsFontSize, optionsFontColor, optionsBgColor }) => {
  checkbox.checked = includeSvg as boolean
  cursorEmojiBtn.textContent = cursorEmoji as string
  multiCursorEmojiBtn.textContent = multiCursorEmoji as string
  cursorSizeInput.value = String(cursorSize)
  moveDot(cursorOffsetX as number, cursorOffsetY as number)
  facingXInput.value = String(facingX)
  facingYInput.value = String(facingY)
  outlineColorInput.value = outlineColor as string
  syncSwatch(outlineColorInput, outlineColorSwatch)
  outlineWidthInput.value = String(outlineWidth)
  insetWidthInput.value = String(insetWidth)
  flashFontSizeInput.value = String(flashFontSize)
  flashPauseInput.value = String(flashPause)
  flashDurationInput.value = String(flashDuration)
  flashFontColorInput.value = flashFontColor as string
  syncSwatch(flashFontColorInput, flashFontColorSwatch)
  optionsFontSizeInput.value = String(optionsFontSize)
  optionsFontColorInput.value = optionsFontColor as string
  syncSwatch(optionsFontColorInput, optionsFontColorSwatch)
  optionsBgColorInput.value = optionsBgColor as string
  syncSwatch(optionsBgColorInput, optionsBgColorSwatch)
  document.body.style.fontSize = `${optionsFontSize}px`
  document.body.style.color = optionsFontColor as string
  document.body.style.background = optionsBgColor as string
})

// Listeners
checkbox.addEventListener('change', () => {
  chrome.storage.sync.set({ includeSvg: checkbox.checked }).then(showSaved)
})

makeEmojiPicker(cursorEmojiBtn, em => {
  chrome.storage.sync.set({ cursorEmoji: em }).then(showSaved)
})
makeEmojiPicker(multiCursorEmojiBtn, em => {
  chrome.storage.sync.set({ multiCursorEmoji: em }).then(showSaved)
})

cursorSizeInput.addEventListener('change', () => {
  chrome.storage.sync.set({ cursorSize: Number(cursorSizeInput.value) }).then(showSaved)
})

facingXInput.addEventListener('change', () => {
  chrome.storage.sync.set({ facingX: Number(facingXInput.value) }).then(showSaved)
})
facingYInput.addEventListener('change', () => {
  chrome.storage.sync.set({ facingY: Number(facingYInput.value) }).then(showSaved)
})

wireColor(outlineColorInput, outlineColorSwatch, 'outlineColor')

outlineWidthInput.addEventListener('change', () => {
  chrome.storage.sync.set({ outlineWidth: Number(outlineWidthInput.value) }).then(showSaved)
})

insetWidthInput.addEventListener('change', () => {
  chrome.storage.sync.set({ insetWidth: Number(insetWidthInput.value) }).then(showSaved)
})

flashFontSizeInput.addEventListener('change', () => {
  chrome.storage.sync.set({ flashFontSize: Number(flashFontSizeInput.value) }).then(showSaved)
})

flashPauseInput.addEventListener('change', () => {
  chrome.storage.sync.set({ flashPause: Number(flashPauseInput.value) }).then(showSaved)
})

flashDurationInput.addEventListener('change', () => {
  chrome.storage.sync.set({ flashDuration: Number(flashDurationInput.value) }).then(showSaved)
})

wireColor(flashFontColorInput, flashFontColorSwatch, 'flashFontColor')

optionsFontSizeInput.addEventListener('input', () => {
  document.body.style.fontSize = `${optionsFontSizeInput.value}px`
})
optionsFontSizeInput.addEventListener('change', () => {
  chrome.storage.sync.set({ optionsFontSize: Number(optionsFontSizeInput.value) }).then(showSaved)
})

wireColor(optionsFontColorInput, optionsFontColorSwatch, 'optionsFontColor', () => { document.body.style.color = optionsFontColorInput.value })
wireColor(optionsBgColorInput, optionsBgColorSwatch, 'optionsBgColor', () => { document.body.style.background = optionsBgColorInput.value })

// Inject custom pixel spinners — must run after all change listeners are attached
document.querySelectorAll<HTMLInputElement>('input[type=number]').forEach(input => {
  const wrap = document.createElement('div')
  wrap.className = 'num-wrap'
  input.parentNode!.insertBefore(wrap, input)
  wrap.appendChild(input)
  const btns = document.createElement('div')
  btns.className = 'num-btns'
  for (const [text, dir] of [['▴', 1], ['▾', -1]] as [string, number][]) {
    const btn = document.createElement('button')
    btn.className = 'num-btn'
    btn.textContent = text
    btn.type = 'button'
    btn.addEventListener('click', () => {
      dir > 0 ? input.stepUp() : input.stepDown()
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    btns.appendChild(btn)
  }
  wrap.appendChild(btns)
})
