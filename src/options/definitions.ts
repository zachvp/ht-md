export type NumberField   = { type: 'number';   id: string; label: string; min: number; max: number; step: number; default: number }
export type ColorField    = { type: 'color';    id: string; label: string; default: string }
export type EmojiField    = { type: 'emoji';    id: string; storageKey: string; label: string; default: string }
export type PlaneField    = { type: 'plane';    label: string; ids: Array<{ id: string; tag: keyof HTMLElementTagNameMap }>; storage: Array<{ key: string; default: number }> }
export type CheckboxField = { type: 'checkbox'; id: string; label: string; tooltip?: string; default: boolean }
export type KeybindField  = { type: 'keybind';  id: string; label: string; default: string }
export type SelectField   = { type: 'select';   id: string; label: string; default: string; options: Array<{ value: string; label: string }> }
export type FieldDef = NumberField | ColorField | EmojiField | PlaneField | CheckboxField | KeybindField | SelectField
export type SectionDef = { rowId: string; fields: FieldDef[] }

export const SECTIONS: SectionDef[] = [
  { rowId: 'row-functionality', fields: [
    { type: 'keybind', id: 'multiSelectKey', label: 'multi-select key', default: 'auto' },
    { type: 'select',  id: 'initialMode',   label: 'initial mode',     default: 'single',
      options: [
        { value: 'single', label: 'single' },
        { value: 'multi',  label: 'multi'  },
      ],
    },
  ]},
  { rowId: 'row-cursor', fields: [
    { type: 'emoji',  id: 'cursorEmojiBtn',      storageKey: 'cursorEmoji',      label: 'cursor',       default: '👆' },
    { type: 'emoji',  id: 'multiCursorEmojiBtn', storageKey: 'multiCursorEmoji', label: 'multiselect',  default: '📋' },
    { type: 'number', id: 'cursorSize',           label: 'size (px)',  min: 16,  max: 1024,  step: 4,   default: 32   },
    { type: 'plane',  label: 'offset (px)', ids: [
      { id: 'offsetCoords', tag: 'span' },
      { id: 'offsetPlane',  tag: 'div'  },
      { id: 'offsetDot',    tag: 'div'  },
    ], storage: [
      { key: 'cursorOffsetX', default: -10 },
      { key: 'cursorOffsetY', default: -10 },
    ]},
  ]},
  { rowId: 'row-highlight', fields: [
    { type: 'color',  id: 'outlineColor', label: 'outline color', default: '#c2934c' },
    { type: 'number', id: 'outlineWidth', label: 'outer (px)', min: 1, max: 1024, step: 1, default: 4 },
    { type: 'number', id: 'insetWidth',   label: 'inner (px)', min: 0, max: 1024, step: 1, default: 4 },
  ]},
  { rowId: 'row-message', fields: [
    { type: 'number', id: 'toastFontSize',     label: 'font (px)',  min: 1,   max: 1024,  step: 1,   default: 20   },
    { type: 'number', id: 'flashPause',        label: 'pause (ms)', min: 0,   max: 5000,  step: 50,  default: 0    },
    { type: 'number', id: 'flashDuration',     label: 'fall (ms)',  min: 100, max: 10000, step: 100, default: 2000 },
    { type: 'number', id: 'flashFallDistance', label: 'dist (px)',  min: 0,   max: 2000,  step: 10,  default: 450  },
    { type: 'color',  id: 'flashFontColor',    label: 'font color', default: '#ffffff'   },
    { type: 'color',  id: 'flashBgColor',      label: 'bg color',   default: '#000000cc' },
  ]},
  { rowId: 'row-options', fields: [
    { type: 'number', id: 'optionsFontSize',  label: 'font (px)', min: 1, max: 1024, step: 1, default: 22       },
    { type: 'color',  id: 'optionsFontColor', label: 'font color',                            default: '#ffffff' },
    { type: 'color',  id: 'optionsBgColor',   label: 'bg color',                              default: '#000000' },
    { type: 'color',  id: 'sectionBgColor',   label: 'section bg',                            default: '#121212' },
  ]},
  { rowId: 'row-badge', fields: [
    { type: 'color',    id: 'badgeBgColor',        label: 'bg color',    default: '#3399ff' },
    { type: 'color',    id: 'badgeFontColor',       label: 'font color',  default: '#ffffff'  },
    { type: 'number',   id: 'badgeFontSize',        label: 'font (px)',   min: 8,   max: 64,   step: 1,   default: 13   },
    { type: 'checkbox', id: 'badgePulse',           label: 'pulse',       default: true },
    { type: 'number',   id: 'badgePulseDuration',   label: 'pulse (ms)',  min: 100, max: 5000, step: 100, default: 1000 },
    { type: 'number',   id: 'badgePulseScale',      label: 'scale (%)',   min: 100, max: 200,  step: 5,   default: 120  },
  ]},
]

export const ADVANCED_FIELDS: FieldDef[] = [
  { type: 'number',   id: 'offsetMax',          label: 'offset max (±)',   min: 1,   max: 1000,  step: 1,   default: 16   },
  { type: 'number',   id: 'savedFlashDuration', label: 'saved flash (ms)', min: 100, max: 10000, step: 100, default: 1500 },
  { type: 'checkbox', id: 'includeSvg', label: 'Include SVG in output', default: false,
    tooltip: 'When on, inline SVGs and SVG data URIs are included in the copied Markdown output.' },
]
