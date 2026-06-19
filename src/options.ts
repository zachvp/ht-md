const checkbox = document.getElementById('includeSvg') as HTMLInputElement
const cursorEmojiInput = document.getElementById('cursorEmoji') as HTMLInputElement
const multiCursorEmojiInput = document.getElementById('multiCursorEmoji') as HTMLInputElement
const cursorSizeInput = document.getElementById('cursorSize') as HTMLInputElement
const offsetPlane = document.getElementById('offsetPlane') as HTMLDivElement
const offsetDot = document.getElementById('offsetDot') as HTMLDivElement
const offsetCoords = document.getElementById('offsetCoords') as HTMLSpanElement
const outlineColorInput = document.getElementById('outlineColor') as HTMLInputElement
const outlineColorSwatch = document.getElementById('outlineColorSwatch') as HTMLSpanElement
const outlineWidthInput = document.getElementById('outlineWidth') as HTMLInputElement
const insetWidthInput = document.getElementById('insetWidth') as HTMLInputElement
const flashFontSizeInput = document.getElementById('flashFontSize') as HTMLInputElement
const flashDurationInput = document.getElementById('flashDuration') as HTMLInputElement
const flashFontColorInput = document.getElementById('flashFontColor') as HTMLInputElement
const flashFontColorSwatch = document.getElementById('flashFontColorSwatch') as HTMLSpanElement
const optionsFontSizeInput = document.getElementById('optionsFontSize') as HTMLInputElement
const optionsFontColorInput = document.getElementById('optionsFontColor') as HTMLInputElement
const optionsFontColorSwatch = document.getElementById('optionsFontColorSwatch') as HTMLSpanElement
const optionsBgColorInput = document.getElementById('optionsBgColor') as HTMLInputElement
const optionsBgColorSwatch = document.getElementById('optionsBgColorSwatch') as HTMLSpanElement
const status = document.getElementById('status') as HTMLParagraphElement

function showSaved(): void {
  status.textContent = 'Saved'
  setTimeout(() => { status.textContent = '' }, 1500)
}

function syncSwatch(input: HTMLInputElement, swatch: HTMLElement): void {
  swatch.style.background = input.value
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
chrome.storage.sync.get({
  includeSvg: false,
  cursorEmoji: '📌',
  multiCursorEmoji: '📝',
  cursorSize: 32,
  cursorOffsetX: -6,
  cursorOffsetY: -6,
  outlineColor: '#ff9900',
  outlineWidth: 2,
  insetWidth: 2,
  flashFontSize: 13,
  flashFontColor: '#ffffff',
  flashDuration: 1500,
  optionsFontSize: 14,
  optionsFontColor: '#000000',
  optionsBgColor: '#ffffff',
}).then(({ includeSvg, cursorEmoji, multiCursorEmoji, cursorSize, cursorOffsetX, cursorOffsetY,
          outlineColor, outlineWidth, insetWidth, flashFontSize, flashFontColor, flashDuration,
          optionsFontSize, optionsFontColor, optionsBgColor }) => {
  checkbox.checked = includeSvg as boolean
  cursorEmojiInput.value = cursorEmoji as string
  multiCursorEmojiInput.value = multiCursorEmoji as string
  cursorSizeInput.value = String(cursorSize)
  moveDot(cursorOffsetX as number, cursorOffsetY as number)
  outlineColorInput.value = outlineColor as string
  syncSwatch(outlineColorInput, outlineColorSwatch)
  outlineWidthInput.value = String(outlineWidth)
  insetWidthInput.value = String(insetWidth)
  flashFontSizeInput.value = String(flashFontSize)
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

cursorEmojiInput.addEventListener('change', () => {
  if (!cursorEmojiInput.value) cursorEmojiInput.value = '📌'
  chrome.storage.sync.set({ cursorEmoji: cursorEmojiInput.value }).then(showSaved)
})

multiCursorEmojiInput.addEventListener('change', () => {
  if (!multiCursorEmojiInput.value) multiCursorEmojiInput.value = '📝'
  chrome.storage.sync.set({ multiCursorEmoji: multiCursorEmojiInput.value }).then(showSaved)
})

cursorSizeInput.addEventListener('change', () => {
  chrome.storage.sync.set({ cursorSize: Number(cursorSizeInput.value) }).then(showSaved)
})

outlineColorInput.addEventListener('input', () => syncSwatch(outlineColorInput, outlineColorSwatch))
outlineColorInput.addEventListener('change', () => {
  chrome.storage.sync.set({ outlineColor: outlineColorInput.value }).then(showSaved)
})

outlineWidthInput.addEventListener('change', () => {
  chrome.storage.sync.set({ outlineWidth: Number(outlineWidthInput.value) }).then(showSaved)
})

insetWidthInput.addEventListener('change', () => {
  chrome.storage.sync.set({ insetWidth: Number(insetWidthInput.value) }).then(showSaved)
})

flashFontSizeInput.addEventListener('change', () => {
  chrome.storage.sync.set({ flashFontSize: Number(flashFontSizeInput.value) }).then(showSaved)
})

flashDurationInput.addEventListener('change', () => {
  chrome.storage.sync.set({ flashDuration: Number(flashDurationInput.value) }).then(showSaved)
})

flashFontColorInput.addEventListener('input', () => syncSwatch(flashFontColorInput, flashFontColorSwatch))
flashFontColorInput.addEventListener('change', () => {
  chrome.storage.sync.set({ flashFontColor: flashFontColorInput.value }).then(showSaved)
})

optionsFontSizeInput.addEventListener('input', () => {
  document.body.style.fontSize = `${optionsFontSizeInput.value}px`
})
optionsFontSizeInput.addEventListener('change', () => {
  chrome.storage.sync.set({ optionsFontSize: Number(optionsFontSizeInput.value) }).then(showSaved)
})

optionsFontColorInput.addEventListener('input', () => {
  syncSwatch(optionsFontColorInput, optionsFontColorSwatch)
  document.body.style.color = optionsFontColorInput.value
})
optionsFontColorInput.addEventListener('change', () => {
  chrome.storage.sync.set({ optionsFontColor: optionsFontColorInput.value }).then(showSaved)
})

optionsBgColorInput.addEventListener('input', () => {
  syncSwatch(optionsBgColorInput, optionsBgColorSwatch)
  document.body.style.background = optionsBgColorInput.value
})
optionsBgColorInput.addEventListener('change', () => {
  chrome.storage.sync.set({ optionsBgColor: optionsBgColorInput.value }).then(showSaved)
})

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
