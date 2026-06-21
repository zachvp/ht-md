import 'emoji-picker-element'
import { SETTINGS_DEFAULTS } from './lib/settings'
import { storage } from './lib/storage'

// #region * Building Blocks *

type NumberField   = { type: 'number';   id: string; label: string; min: number; max: number; step: number }
type ColorField    = { type: 'color';    id: string; label: string }
type EmojiField    = { type: 'emoji';    id: string; label: string }
type PlaneField    = { type: 'plane';    label: string }
type CheckboxField = { type: 'checkbox'; id: string; label: string; tooltip?: string }
type FieldDef = NumberField | ColorField | EmojiField | PlaneField | CheckboxField
type SectionDef = { rowId: string; fields: FieldDef[] }

const SECTIONS: SectionDef[] = [
  { rowId: 'row-cursor', fields: [
    { type: 'emoji',  id: 'cursorEmojiBtn',      label: 'cursor' },
    { type: 'emoji',  id: 'multiCursorEmojiBtn', label: 'multiselect' },
    { type: 'number', id: 'cursorSize',           label: 'size (px)',  min: 16,  max: 1024,  step: 4   },
    { type: 'plane',  label: 'offset (px)' },
  ]},
  { rowId: 'row-highlight', fields: [
    { type: 'color',  id: 'outlineColor', label: 'outline color' },
    { type: 'number', id: 'outlineWidth', label: 'outer (px)', min: 1, max: 1024, step: 1 },
    { type: 'number', id: 'insetWidth',   label: 'inner (px)', min: 0, max: 1024, step: 1 },
  ]},
  { rowId: 'row-message', fields: [
    { type: 'number', id: 'flashFontSize',     label: 'font (px)',  min: 1,   max: 1024,  step: 1   },
    { type: 'number', id: 'flashPause',        label: 'pause (ms)', min: 0,   max: 5000,  step: 50  },
    { type: 'number', id: 'flashDuration',     label: 'fall (ms)',  min: 100, max: 10000, step: 100 },
    { type: 'number', id: 'flashFallDistance', label: 'dist (px)',  min: 0,   max: 2000,  step: 10  },
    { type: 'color',  id: 'flashFontColor',    label: 'font color' },
    { type: 'color',  id: 'flashBgColor',      label: 'bg color' },
  ]},
  { rowId: 'row-options', fields: [
    { type: 'number', id: 'optionsFontSize',  label: 'font (px)', min: 1, max: 1024, step: 1 },
    { type: 'color',  id: 'optionsFontColor', label: 'font color' },
    { type: 'color',  id: 'optionsBgColor',   label: 'bg color' },
    { type: 'color',  id: 'sectionBgColor',   label: 'section bg' },
  ]},
  { rowId: 'row-badge', fields: [
    { type: 'color',  id: 'badgeBgColor',   label: 'bg color' },
    { type: 'color',  id: 'badgeFontColor', label: 'font color' },
    { type: 'number', id: 'badgeFontSize',  label: 'font (px)', min: 8, max: 64, step: 1 },
  ]},
]

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), attrs)
}

function fieldStack(label: string, ...children: HTMLElement[]): HTMLDivElement {
  const div = el('div', { className: 'field-stack' })
  const lbl = el('span', { className: 'field-label', textContent: label })
  div.append(...children, lbl)
  return div
}

function buildNumberField(f: NumberField): HTMLElement {
  const input = el('input', { id: f.id, min: String(f.min), max: String(f.max), step: String(f.step) })
  input.type = 'number'
  return fieldStack(f.label, input)
}

function buildColorField(f: ColorField): HTMLElement {
  const input = el('input', { id: f.id, className: 'color-text', placeholder: '#rrggbbaa' })
  input.type = 'text'
  const swatch = el('span', { className: 'color-band', id: `${f.id}Swatch` })
  return fieldStack(f.label, input, swatch)
}

function buildEmojiField(f: EmojiField): HTMLElement {
  const wrap = el('div', { className: 'emoji-pick-wrap' })
  const btn = el('button', { className: 'emoji-pick-btn', id: f.id })
  btn.type = 'button'
  wrap.append(btn)
  return fieldStack(f.label, wrap)
}

function buildPlaneField(f: PlaneField): HTMLElement {
  const coords = el('span', { className: 'plane-coords', id: 'offsetCoords', textContent: '0, 0' })
  const plane  = el('div',  { className: 'plane', id: 'offsetPlane' })
  const dot    = el('div',  { className: 'plane-dot', id: 'offsetDot' })
  plane.append(el('div', { className: 'plane-hline' }), el('div', { className: 'plane-vline' }), dot)
  return fieldStack(f.label, coords, plane)
}

function buildCheckboxField(f: CheckboxField): HTMLElement {
  const section = el('div', { className: 'section setting' })
  const label   = el('label', { className: 'checkbox' })
  const input   = el('input', { id: f.id })
  input.type = 'checkbox'
  label.append(input, document.createTextNode(` ${f.label}`))
  if (f.tooltip) {
    const wrap = el('span', { className: 'info-wrap' })
    const icon = el('span', { className: 'info-icon', textContent: 'ⓘ' })
    const tip  = el('span', { className: 'info-tip',  textContent: f.tooltip })
    wrap.append(icon, tip)
    label.append(wrap)
  }
  section.append(label)
  return section
}

const FIELD_BUILDERS = {
  number:   buildNumberField,
  color:    buildColorField,
  emoji:    buildEmojiField,
  plane:    buildPlaneField,
  checkbox: buildCheckboxField,
} as const

function buildField(f: FieldDef): HTMLElement {
  return (FIELD_BUILDERS[f.type] as (f: FieldDef) => HTMLElement)(f)
}

const ADVANCED_FIELDS: FieldDef[] = [
  { type: 'number',   id: 'offsetMax',          label: 'offset max (±)',   min: 1,   max: 1000,  step: 1   },
  { type: 'number',   id: 'savedFlashDuration', label: 'saved flash (ms)', min: 100, max: 10000, step: 100 },
  { type: 'checkbox', id: 'includeSvg', label: 'Include SVG in output',
    tooltip: 'When on, inline SVGs and SVG data URIs are included in the copied Markdown output.' },
]

SECTIONS.forEach(s => {
  const row = document.getElementById(s.rowId)!
  s.fields.forEach(f => row.append(buildField(f)))
})
ADVANCED_FIELDS.forEach(f => document.getElementById('row-advanced')!.append(buildField(f)))

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

function wireColor(input: HTMLInputElement, onInput?: () => void): void {
  const swatch = document.getElementById(`${input.id}Swatch`) as HTMLElement
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
    storage.set({ [input.id]: input.value }).then(showSaved)
  })

  input.addEventListener('input', () => { syncSwatch(input, swatch); onInput?.() })
  input.addEventListener('change', () => storage.set({ [input.id]: input.value }).then(showSaved))
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

// #endregion

// #region * Page Wiring *

const checkbox = document.getElementById('includeSvg') as HTMLInputElement
const cursorEmojiBtn = document.getElementById('cursorEmojiBtn') as HTMLButtonElement
const multiCursorEmojiBtn = document.getElementById('multiCursorEmojiBtn') as HTMLButtonElement
const cursorSizeInput = document.getElementById('cursorSize') as HTMLInputElement
const offsetPlane = document.getElementById('offsetPlane') as HTMLDivElement
const offsetDot = document.getElementById('offsetDot') as HTMLDivElement
const offsetCoords = document.getElementById('offsetCoords') as HTMLSpanElement
const outlineColorInput = document.getElementById('outlineColor') as HTMLInputElement
const outlineWidthInput = document.getElementById('outlineWidth') as HTMLInputElement
const insetWidthInput = document.getElementById('insetWidth') as HTMLInputElement
const flashFontSizeInput = document.getElementById('flashFontSize') as HTMLInputElement
const flashPauseInput = document.getElementById('flashPause') as HTMLInputElement
const flashDurationInput = document.getElementById('flashDuration') as HTMLInputElement
const flashFallDistanceInput = document.getElementById('flashFallDistance') as HTMLInputElement
const flashFontColorInput = document.getElementById('flashFontColor') as HTMLInputElement
const flashBgColorInput = document.getElementById('flashBgColor') as HTMLInputElement
const badgeBgColorInput = document.getElementById('badgeBgColor') as HTMLInputElement
const badgeFontColorInput = document.getElementById('badgeFontColor') as HTMLInputElement
const badgeFontSizeInput = document.getElementById('badgeFontSize') as HTMLInputElement
const optionsFontSizeInput = document.getElementById('optionsFontSize') as HTMLInputElement
const optionsFontColorInput = document.getElementById('optionsFontColor') as HTMLInputElement
const optionsBgColorInput = document.getElementById('optionsBgColor') as HTMLInputElement
const sectionBgColorInput = document.getElementById('sectionBgColor') as HTMLInputElement
const offsetMaxInput = document.getElementById('offsetMax') as HTMLInputElement
const savedFlashDurationInput = document.getElementById('savedFlashDuration') as HTMLInputElement
const status = document.getElementById('status') as HTMLParagraphElement
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement
const importFile = document.getElementById('importFile') as HTMLInputElement
const copyJsonBtn = document.getElementById('copyJsonBtn') as HTMLButtonElement
const applyJsonBtn = document.getElementById('applyJsonBtn') as HTMLButtonElement
const configJsonTextarea = document.getElementById('configJson') as HTMLTextAreaElement

// Load
storage.get(SETTINGS_DEFAULTS).then(s => {
  const stored = s as typeof SETTINGS_DEFAULTS
  const allFields = [...SECTIONS.flatMap(s => s.fields), ...ADVANCED_FIELDS]
  for (const f of allFields) {
    if (f.type === 'number' || f.type === 'color') {
      const input = document.getElementById(f.id) as HTMLInputElement
      input.value = String(stored[f.id as keyof typeof SETTINGS_DEFAULTS])
      if (f.type === 'color') syncSwatch(input, document.getElementById(`${f.id}Swatch`) as HTMLElement)
    }
  }
  OFFSET_MAX = stored.offsetMax
  savedFlashDuration = stored.savedFlashDuration
  checkbox.checked = stored.includeSvg
  cursorEmojiBtn.textContent = stored.cursorEmoji
  multiCursorEmojiBtn.textContent = stored.multiCursorEmoji
  moveDot(stored.cursorOffsetX, stored.cursorOffsetY)
  document.body.style.fontSize = `${stored.optionsFontSize}px`
  document.body.style.color = stored.optionsFontColor
  document.body.style.background = stored.optionsBgColor
  pickerColors.fontColor = stored.optionsFontColor
  pickerColors.bgColor = stored.optionsBgColor
  applyDocumentTheme(stored.optionsFontColor, stored.optionsBgColor)
  document.documentElement.style.setProperty('--ui-overlay-xs', stored.sectionBgColor)
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

wireColor(badgeBgColorInput)
wireColor(badgeFontColorInput)
badgeFontSizeInput.addEventListener('change', () => {
  storage.set({ badgeFontSize: Number(badgeFontSizeInput.value) }).then(showSaved)
})

wireColor(outlineColorInput)

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

wireColor(flashFontColorInput)
wireColor(flashBgColorInput)

optionsFontSizeInput.addEventListener('input', () => {
  document.body.style.fontSize = `${optionsFontSizeInput.value}px`
})
optionsFontSizeInput.addEventListener('change', () => {
  storage.set({ optionsFontSize: Number(optionsFontSizeInput.value) }).then(showSaved)
})

wireColor(optionsFontColorInput, () => {
  document.body.style.color = optionsFontColorInput.value
  pickerColors.fontColor = optionsFontColorInput.value
  applyDocumentTheme(optionsFontColorInput.value, optionsBgColorInput.value)
})
wireColor(optionsBgColorInput, () => {
  document.body.style.background = optionsBgColorInput.value
  pickerColors.bgColor = optionsBgColorInput.value
  applyDocumentTheme(optionsFontColorInput.value, optionsBgColorInput.value)
})
wireColor(sectionBgColorInput, () => {
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

// #endregion