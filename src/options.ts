import 'emoji-picker-element'
import { EXT_NAME } from './lib/constants'
import { SETTINGS_DEFAULTS } from './lib/settings.generated'
import { storage } from './lib/storage'
import { SECTIONS } from './options/definitions'
import type { NumberField, ColorField, EmojiField, PlaneField, CheckboxField, KeybindField, SelectField, FieldDef } from './options/definitions'
import { els } from './options/elements.generated'

// #region * Building Blocks *

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), attrs)
}

function labeledControl(className: string, lbl: HTMLElement, ...children: HTMLElement[]): HTMLDivElement {
  const div = el('div', { className })
  div.append(...children, lbl)
  return div
}

function fieldStack(label: string, ...children: HTMLElement[]): HTMLDivElement {
  return labeledControl('field-stack', el('span', { className: 'field-label', textContent: label }), ...children)
}

function fieldRow(label: string, forId: string, ...children: HTMLElement[]): HTMLDivElement {
  return labeledControl('field-row', el('label', { className: 'field-label', textContent: label, htmlFor: forId }), ...children)
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
  return fieldStack(f.label, swatch, input)
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

function buildSelectField(f: SelectField): HTMLElement {
  const wrap   = el('div', { className: 'select-wrap' })
  const select = el('select', { id: f.id })
  for (const opt of f.options) {
    select.append(el('option', { value: opt.value, textContent: opt.label }))
  }
  wrap.append(select)
  return fieldStack(f.label, wrap)
}

function buildKeybindField(f: KeybindField): HTMLElement {
  const btn = el('button', { id: f.id, className: 'cfg-btn' })
  btn.type = 'button'
  return fieldStack(f.label, btn)
}

function buildCheckboxField(f: CheckboxField): HTMLElement {
  const input = el('input', { id: f.id })
  input.type = 'checkbox'
  const row = fieldRow(f.label, f.id, input)
  if (f.tooltip) {
    const wrap = el('span', { className: 'info-wrap' })
    const icon = el('span', { className: 'info-icon', textContent: 'ⓘ' })
    const tip  = el('span', { className: 'info-tip',  textContent: f.tooltip })
    wrap.append(icon, tip)
    row.append(wrap)
  }
  return row
}

const FIELD_BUILDERS = {
  number:   buildNumberField,
  color:    buildColorField,
  emoji:    buildEmojiField,
  plane:    buildPlaneField,
  checkbox: buildCheckboxField,
  keybind:  buildKeybindField,
  select:   buildSelectField,
} as const

function buildField(f: FieldDef): HTMLElement {
  return (FIELD_BUILDERS[f.type] as (f: FieldDef) => HTMLElement)(f)
}

document.title = `${EXT_NAME} settings`
;(document.querySelector('h1') as HTMLElement).textContent = `${EXT_NAME} settings`

SECTIONS.forEach(s => {
  const row = document.getElementById(s.rowId)!
  s.fields.forEach(f => row.append(buildField(f)))
})

// Group pulse toggle + params into a full-width column: toggle on top, collapsible params below
const badgePulseParams = (() => {
  const group  = el('div', { className: 'badge-pulse-group' })
  const params = el('div', { className: 'badge-pulse-params' })

  const pulseSection = els.badgePulse.closest('.field-row') as HTMLElement
  pulseSection.replaceWith(group)
  group.append(pulseSection)

  const dur = els.badgePulseDuration.parentElement!
  dur.replaceWith(params)
  params.append(dur, els.badgePulseScale.parentElement!)
  group.append(params)

  return params
})()

function syncBadgePulseParams(): void {
  badgePulseParams.hidden = !els.badgePulse.checked
}

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

function wireKeybind(btn: HTMLButtonElement, storageKey: string, initialValue: string): void {
  let current = initialValue
  btn.textContent = current

  btn.addEventListener('click', () => {
    btn.textContent = 'press a key...'
    function onKey(e: KeyboardEvent): void {
      e.preventDefault()
      e.stopPropagation()
      document.removeEventListener('keydown', onKey, true)
      if (e.key === 'Escape') { btn.textContent = current; return }
      current = e.key
      btn.textContent = current
      storage.set({ [storageKey]: current }).then(showSaved)
    }
    document.addEventListener('keydown', onKey, true)
  })
}

let savedFlashDuration = 1500

function showSaved(): void {
  els.status.textContent = 'Saved'
  setTimeout(() => { els.status.textContent = '' }, savedFlashDuration)
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
  els.offsetDot.style.left = `${(curOffsetX + OFFSET_MAX) / (OFFSET_MAX * 2) * 100}%`
  els.offsetDot.style.top = `${(OFFSET_MAX - curOffsetY) / (OFFSET_MAX * 2) * 100}%`
  els.offsetCoords.textContent = `${curOffsetX}, ${curOffsetY}`
}

function planeVals(e: MouseEvent): { x: number; y: number } {
  const r = els.offsetPlane.getBoundingClientRect()
  return {
    x: (e.clientX - r.left) / r.width * (OFFSET_MAX * 2) - OFFSET_MAX,
    y: OFFSET_MAX - (e.clientY - r.top) / r.height * (OFFSET_MAX * 2),
  }
}

// #endregion

// #region * Page Wiring *

const allFields = SECTIONS.flatMap(s => s.fields)

// Load
storage.get(SETTINGS_DEFAULTS).then(s => {
  const stored = s as typeof SETTINGS_DEFAULTS
  for (const f of allFields) {
    if (f.type === 'number' || f.type === 'color') {
      const input = document.getElementById(f.id) as HTMLInputElement
      input.value = String(stored[f.id as keyof typeof SETTINGS_DEFAULTS])
      if (f.type === 'color') syncSwatch(input, document.getElementById(`${f.id}Swatch`) as HTMLElement)
    }
  }
  OFFSET_MAX = stored.offsetMax
  savedFlashDuration = stored.savedFlashDuration
  els.initialMode.value = String(stored.initialMode)
  els.includeSvg.checked = stored.includeSvg
  els.badgePulse.checked = stored.badgePulse
  syncBadgePulseParams()
  els.cursorEmojiBtn.textContent = stored.cursorEmoji
  els.multiCursorEmojiBtn.textContent = stored.multiCursorEmoji
  for (const f of allFields) {
    if (f.type !== 'keybind') continue
    const btn = els[f.id as keyof typeof els] as HTMLButtonElement
    wireKeybind(btn, f.id, String(stored[f.id as keyof typeof SETTINGS_DEFAULTS]))
  }
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
    els.configJson.value = JSON.stringify(stored, null, 2)
  })
})

// Listeners
els.initialMode.addEventListener('change', () => {
  storage.set({ initialMode: els.initialMode.value }).then(showSaved)
})
els.includeSvg.addEventListener('change', () => {
  storage.set({ includeSvg: els.includeSvg.checked }).then(showSaved)
})
els.badgePulse.addEventListener('change', () => {
  storage.set({ badgePulse: els.badgePulse.checked }).then(showSaved)
  syncBadgePulseParams()
})

for (const f of allFields) {
  if (f.type !== 'emoji') continue
  const btn = els[f.id as keyof typeof els] as HTMLButtonElement
  makeEmojiPicker(btn, em => { storage.set({ [f.storageKey]: em }).then(showSaved) })
}

for (const f of allFields) {
  if (f.type !== 'number') continue
  const input = els[f.id as keyof typeof els] as HTMLInputElement
  input.addEventListener('change', () => { storage.set({ [f.id]: Number(input.value) }).then(showSaved) })
}

els.offsetPlane.addEventListener('mousedown', (e) => {
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

wireColor(els.badgeBgColor)
wireColor(els.badgeFontColor)
wireColor(els.outlineColor)

wireColor(els.flashFontColor)
wireColor(els.flashBgColor)

els.optionsFontSize.addEventListener('input', () => {
  document.body.style.fontSize = `${els.optionsFontSize.value}px`
})

wireColor(els.optionsFontColor, () => {
  document.body.style.color = els.optionsFontColor.value
  pickerColors.fontColor = els.optionsFontColor.value
  applyDocumentTheme(els.optionsFontColor.value, els.optionsBgColor.value)
})
wireColor(els.optionsBgColor, () => {
  document.body.style.background = els.optionsBgColor.value
  pickerColors.bgColor = els.optionsBgColor.value
  applyDocumentTheme(els.optionsFontColor.value, els.optionsBgColor.value)
})
wireColor(els.sectionBgColor, () => {
  document.documentElement.style.setProperty('--ui-overlay-xs', els.sectionBgColor.value)
})

els.offsetMax.addEventListener('change', () => { OFFSET_MAX = Number(els.offsetMax.value) })
els.savedFlashDuration.addEventListener('change', () => { savedFlashDuration = Number(els.savedFlashDuration.value) })

// Import / export
els.copyJsonBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(els.configJson.value).then(() => showSaved())
})

els.applyJsonBtn.addEventListener('click', () => {
  applyJsonString(els.configJson.value)
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
    els.status.textContent = 'Invalid JSON'
  }
}

els.exportBtn.addEventListener('click', () => {
  storage.get(SETTINGS_DEFAULTS).then(stored => {
    const json = JSON.stringify(stored, null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = `${EXT_NAME}-settings.json`
    a.click()
    URL.revokeObjectURL(a.href)
  })
})

els.importFile.addEventListener('change', () => {
  const file = els.importFile.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => applyJsonString(reader.result as string)
  reader.readAsText(file)
  els.importFile.value = ''
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
