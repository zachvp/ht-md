const checkbox = document.getElementById('includeSvg') as HTMLInputElement
const cursorEmojiBtn = document.getElementById('cursorEmojiBtn') as HTMLButtonElement
const multiCursorEmojiBtn = document.getElementById('multiCursorEmojiBtn') as HTMLButtonElement
const cursorSizeInput = document.getElementById('cursorSize') as HTMLInputElement
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
const flashFallDistanceInput = document.getElementById('flashFallDistance') as HTMLInputElement
const flashFontColorInput = document.getElementById('flashFontColor') as HTMLInputElement
const flashFontColorSwatch = document.getElementById('flashFontColorSwatch') as HTMLSpanElement
const flashBgColorInput = document.getElementById('flashBgColor') as HTMLInputElement
const flashBgColorSwatch = document.getElementById('flashBgColorSwatch') as HTMLSpanElement
const badgeBgColorInput = document.getElementById('badgeBgColor') as HTMLInputElement
const badgeBgColorSwatch = document.getElementById('badgeBgColorSwatch') as HTMLSpanElement
const badgeFontColorInput = document.getElementById('badgeFontColor') as HTMLInputElement
const badgeFontColorSwatch = document.getElementById('badgeFontColorSwatch') as HTMLSpanElement
const badgeFontSizeInput = document.getElementById('badgeFontSize') as HTMLInputElement
const optionsFontSizeInput = document.getElementById('optionsFontSize') as HTMLInputElement
const optionsFontColorInput = document.getElementById('optionsFontColor') as HTMLInputElement
const optionsFontColorSwatch = document.getElementById('optionsFontColorSwatch') as HTMLSpanElement
const optionsBgColorInput = document.getElementById('optionsBgColor') as HTMLInputElement
const optionsBgColorSwatch = document.getElementById('optionsBgColorSwatch') as HTMLSpanElement
const sectionBgColorInput = document.getElementById('sectionBgColor') as HTMLInputElement
const sectionBgColorSwatch = document.getElementById('sectionBgColorSwatch') as HTMLSpanElement
const offsetMaxInput = document.getElementById('offsetMax') as HTMLInputElement
const savedFlashDurationInput = document.getElementById('savedFlashDuration') as HTMLInputElement
const status = document.getElementById('status') as HTMLParagraphElement
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement
const importFile = document.getElementById('importFile') as HTMLInputElement
const copyJsonBtn = document.getElementById('copyJsonBtn') as HTMLButtonElement
const applyJsonBtn = document.getElementById('applyJsonBtn') as HTMLButtonElement
const configJsonTextarea = document.getElementById('configJson') as HTMLTextAreaElement

import 'emoji-picker-element'
import { SETTINGS_DEFAULTS } from './lib/settings'
import { storage } from './lib/storage'

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
  const s = hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (s) return [parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16), parseInt(s[3] + s[3], 16)]
  return null
}

function getAlphaSuffix(hex: string): string {
  return /^#[0-9a-f]{8}$/i.test(hex) ? hex.slice(7) : ''
}

function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color)
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})` : color
}

const pickerColors = {
  fontColor: SETTINGS_DEFAULTS.optionsFontColor,
  bgColor: SETTINGS_DEFAULTS.optionsBgColor,
}

function applyDocumentTheme(fontColor: string, bgColor: string): void {
  const r = document.documentElement.style
  r.setProperty('--ui-overlay-sm', withAlpha(fontColor, 0.08))
  r.setProperty('--ui-overlay-md', withAlpha(fontColor, 0.12))
  r.setProperty('--ui-overlay-lg', withAlpha(fontColor, 0.22))
  r.setProperty('--ui-shadow', withAlpha(fontColor, 0.25))
}

function applyPickerTheme(picker: HTMLElement, fontColor: string, bgColor: string): void {
  picker.style.setProperty('--background', bgColor)
  picker.style.setProperty('--border-color', withAlpha(fontColor, 0.2))
  picker.style.setProperty('--button-active-background', withAlpha(fontColor, 0.2))
  picker.style.setProperty('--button-hover-background', withAlpha(fontColor, 0.12))
  picker.style.setProperty('--category-font-color', fontColor)
  picker.style.setProperty('--input-border-color', withAlpha(fontColor, 0.4))
  picker.style.setProperty('--input-font-color', fontColor)
  picker.style.setProperty('--input-placeholder-color', withAlpha(fontColor, 0.5))
  picker.style.setProperty('--outline-color', withAlpha(fontColor, 0.5))
}

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
    applyPickerTheme(picker, pickerColors.fontColor, pickerColors.bgColor)
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

let savedFlashDuration = 1500

function showSaved(): void {
  status.textContent = 'Saved'
  setTimeout(() => { status.textContent = '' }, savedFlashDuration)
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
  const picker = document.createElement('input')
  picker.type = 'color'
  picker.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none'
  swatch.parentElement!.appendChild(picker)

  swatch.style.cursor = 'pointer'
  swatch.addEventListener('click', () => {
    picker.value = input.value.startsWith('#') ? input.value.slice(0, 7) : '#000000'
    picker.click()
  })
  picker.addEventListener('input', () => {
    input.value = picker.value + getAlphaSuffix(input.value)
    syncSwatch(input, swatch)
    onInput?.()
  })
  picker.addEventListener('change', () => {
    input.value = picker.value + getAlphaSuffix(input.value)
    syncSwatch(input, swatch)
    onInput?.()
    storage.set({ [storageKey]: input.value }).then(showSaved)
  })

  input.addEventListener('input', () => { syncSwatch(input, swatch); onInput?.() })
  input.addEventListener('change', () => storage.set({ [storageKey]: input.value }).then(showSaved))
}

// 2D offset plane
let OFFSET_MAX = 10
let planeDragging = false
let curOffsetX = 0
let curOffsetY = 0

function moveDot(x: number, y: number): void {
  curOffsetX = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, Math.round(x)))
  curOffsetY = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, Math.round(y)))
  offsetDot.style.left = `${(curOffsetX + OFFSET_MAX) / (OFFSET_MAX * 2) * 100}%`
  offsetDot.style.top = `${(OFFSET_MAX - curOffsetY) / (OFFSET_MAX * 2) * 100}%`
  offsetCoords.textContent = `${curOffsetX}, ${curOffsetY}`
}

function planeVals(e: MouseEvent): { x: number; y: number } {
  const r = offsetPlane.getBoundingClientRect()
  return {
    x: (e.clientX - r.left) / r.width * (OFFSET_MAX * 2) - OFFSET_MAX,
    y: OFFSET_MAX - (e.clientY - r.top) / r.height * (OFFSET_MAX * 2),
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
  storage.set({ cursorOffsetX: curOffsetX, cursorOffsetY: curOffsetY }).then(showSaved)
})

// Load
storage.get(SETTINGS_DEFAULTS).then(({ includeSvg, cursorEmoji, multiCursorEmoji, cursorSize, cursorOffsetX, cursorOffsetY,
          outlineColor, outlineWidth, insetWidth, flashFontSize, flashFontColor, flashBgColor, flashPause, flashDuration, flashFallDistance,
          badgeBgColor, badgeFontColor, badgeFontSize,
          optionsFontSize, optionsFontColor, optionsBgColor, sectionBgColor, offsetMax, savedFlashDuration: sfd }) => {
  OFFSET_MAX = offsetMax as number
  checkbox.checked = includeSvg as boolean
  cursorEmojiBtn.textContent = cursorEmoji as string
  multiCursorEmojiBtn.textContent = multiCursorEmoji as string
  cursorSizeInput.value = String(cursorSize)
  moveDot(cursorOffsetX as number, cursorOffsetY as number)
  outlineColorInput.value = outlineColor as string
  syncSwatch(outlineColorInput, outlineColorSwatch)
  outlineWidthInput.value = String(outlineWidth)
  insetWidthInput.value = String(insetWidth)
  flashFontSizeInput.value = String(flashFontSize)
  flashPauseInput.value = String(flashPause)
  flashDurationInput.value = String(flashDuration)
  flashFallDistanceInput.value = String(flashFallDistance)
  flashFontColorInput.value = flashFontColor as string
  syncSwatch(flashFontColorInput, flashFontColorSwatch)
  flashBgColorInput.value = flashBgColor as string
  syncSwatch(flashBgColorInput, flashBgColorSwatch)
  badgeBgColorInput.value = badgeBgColor as string
  syncSwatch(badgeBgColorInput, badgeBgColorSwatch)
  badgeFontColorInput.value = badgeFontColor as string
  syncSwatch(badgeFontColorInput, badgeFontColorSwatch)
  badgeFontSizeInput.value = String(badgeFontSize)
  optionsFontSizeInput.value = String(optionsFontSize)
  optionsFontColorInput.value = optionsFontColor as string
  syncSwatch(optionsFontColorInput, optionsFontColorSwatch)
  optionsBgColorInput.value = optionsBgColor as string
  syncSwatch(optionsBgColorInput, optionsBgColorSwatch)
  document.body.style.fontSize = `${optionsFontSize}px`
  document.body.style.color = optionsFontColor as string
  document.body.style.background = optionsBgColor as string
  pickerColors.fontColor = optionsFontColor as string
  pickerColors.bgColor = optionsBgColor as string
  applyDocumentTheme(optionsFontColor as string, optionsBgColor as string)
  sectionBgColorInput.value = sectionBgColor as string
  syncSwatch(sectionBgColorInput, sectionBgColorSwatch)
  document.documentElement.style.setProperty('--ui-overlay-xs', sectionBgColor as string)
  offsetMaxInput.value = String(offsetMax)
  savedFlashDuration = sfd as number
  savedFlashDurationInput.value = String(sfd)
}).then(() => {
  storage.get(SETTINGS_DEFAULTS).then(stored => {
    configJsonTextarea.value = JSON.stringify(stored, null, 2)
  })
})

// Listeners
checkbox.addEventListener('change', () => {
  storage.set({ includeSvg: checkbox.checked }).then(showSaved)
})

makeEmojiPicker(cursorEmojiBtn, em => {
  storage.set({ cursorEmoji: em }).then(showSaved)
})
makeEmojiPicker(multiCursorEmojiBtn, em => {
  storage.set({ multiCursorEmoji: em }).then(showSaved)
})

cursorSizeInput.addEventListener('change', () => {
  storage.set({ cursorSize: Number(cursorSizeInput.value) }).then(showSaved)
})

wireColor(badgeBgColorInput, badgeBgColorSwatch, 'badgeBgColor')
wireColor(badgeFontColorInput, badgeFontColorSwatch, 'badgeFontColor')
badgeFontSizeInput.addEventListener('change', () => {
  storage.set({ badgeFontSize: Number(badgeFontSizeInput.value) }).then(showSaved)
})

wireColor(outlineColorInput, outlineColorSwatch, 'outlineColor')

outlineWidthInput.addEventListener('change', () => {
  storage.set({ outlineWidth: Number(outlineWidthInput.value) }).then(showSaved)
})

insetWidthInput.addEventListener('change', () => {
  storage.set({ insetWidth: Number(insetWidthInput.value) }).then(showSaved)
})

flashFontSizeInput.addEventListener('change', () => {
  storage.set({ flashFontSize: Number(flashFontSizeInput.value) }).then(showSaved)
})

flashPauseInput.addEventListener('change', () => {
  storage.set({ flashPause: Number(flashPauseInput.value) }).then(showSaved)
})

flashDurationInput.addEventListener('change', () => {
  storage.set({ flashDuration: Number(flashDurationInput.value) }).then(showSaved)
})

flashFallDistanceInput.addEventListener('change', () => {
  storage.set({ flashFallDistance: Number(flashFallDistanceInput.value) }).then(showSaved)
})

wireColor(flashFontColorInput, flashFontColorSwatch, 'flashFontColor')
wireColor(flashBgColorInput, flashBgColorSwatch, 'flashBgColor')

optionsFontSizeInput.addEventListener('input', () => {
  document.body.style.fontSize = `${optionsFontSizeInput.value}px`
})
optionsFontSizeInput.addEventListener('change', () => {
  storage.set({ optionsFontSize: Number(optionsFontSizeInput.value) }).then(showSaved)
})

wireColor(optionsFontColorInput, optionsFontColorSwatch, 'optionsFontColor', () => {
  document.body.style.color = optionsFontColorInput.value
  pickerColors.fontColor = optionsFontColorInput.value
  applyDocumentTheme(optionsFontColorInput.value, optionsBgColorInput.value)
})
wireColor(optionsBgColorInput, optionsBgColorSwatch, 'optionsBgColor', () => {
  document.body.style.background = optionsBgColorInput.value
  pickerColors.bgColor = optionsBgColorInput.value
  applyDocumentTheme(optionsFontColorInput.value, optionsBgColorInput.value)
})
wireColor(sectionBgColorInput, sectionBgColorSwatch, 'sectionBgColor', () => {
  document.documentElement.style.setProperty('--ui-overlay-xs', sectionBgColorInput.value)
})

offsetMaxInput.addEventListener('change', () => {
  OFFSET_MAX = Number(offsetMaxInput.value)
  storage.set({ offsetMax: OFFSET_MAX }).then(showSaved)
})

savedFlashDurationInput.addEventListener('change', () => {
  savedFlashDuration = Number(savedFlashDurationInput.value)
  storage.set({ savedFlashDuration }).then(showSaved)
})

// Import / export
copyJsonBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(configJsonTextarea.value).then(() => showSaved())
})

applyJsonBtn.addEventListener('click', () => {
  applyJsonString(configJsonTextarea.value)
})

function applyJsonString(text: string): void {
  try {
    const parsed = JSON.parse(text)
    const filtered: Record<string, unknown> = {}
    for (const key of Object.keys(SETTINGS_DEFAULTS) as (keyof typeof SETTINGS_DEFAULTS)[]) {
      if (key in parsed) filtered[key] = parsed[key]
    }
    storage.set(filtered).then(() => { showSaved(); location.reload() })
  } catch {
    status.textContent = 'Invalid JSON'
  }
}

exportBtn.addEventListener('click', () => {
  storage.get(SETTINGS_DEFAULTS).then(stored => {
    const json = JSON.stringify(stored, null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = 'web-md-settings.json'
    a.click()
    URL.revokeObjectURL(a.href)
  })
})

importFile.addEventListener('change', () => {
  const file = importFile.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => applyJsonString(reader.result as string)
  reader.readAsText(file)
  importFile.value = ''
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
