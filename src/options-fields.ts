export type NumberField   = { type: 'number';   id: string; label: string; min: number; max: number; step: number }
export type ColorField    = { type: 'color';    id: string; label: string }
export type EmojiField    = { type: 'emoji';    id: string; label: string }
export type PlaneField    = { type: 'plane';    label: string; ids: Array<{ id: string; tag: keyof HTMLElementTagNameMap }> }
export type CheckboxField = { type: 'checkbox'; id: string; label: string; tooltip?: string }
export type FieldDef = NumberField | ColorField | EmojiField | PlaneField | CheckboxField
export type SectionDef = { rowId: string; fields: FieldDef[] }

export const SECTIONS: SectionDef[] = [
  { rowId: 'row-cursor', fields: [
    { type: 'emoji',  id: 'cursorEmojiBtn',      label: 'cursor' },
    { type: 'emoji',  id: 'multiCursorEmojiBtn', label: 'multiselect' },
    { type: 'number', id: 'cursorSize',           label: 'size (px)',  min: 16,  max: 1024,  step: 4   },
    { type: 'plane',  label: 'offset (px)', ids: [
      { id: 'offsetCoords', tag: 'span' },
      { id: 'offsetPlane',  tag: 'div'  },
      { id: 'offsetDot',    tag: 'div'  },
    ]},
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

export const ADVANCED_FIELDS: FieldDef[] = [
  { type: 'number',   id: 'offsetMax',          label: 'offset max (±)',   min: 1,   max: 1000,  step: 1   },
  { type: 'number',   id: 'savedFlashDuration', label: 'saved flash (ms)', min: 100, max: 10000, step: 100 },
  { type: 'checkbox', id: 'includeSvg', label: 'Include SVG in output',
    tooltip: 'When on, inline SVGs and SVG data URIs are included in the copied Markdown output.' },
]
