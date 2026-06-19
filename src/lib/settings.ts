export const SETTINGS_DEFAULTS = {
  includeSvg: false,
  cursorSize: 32,
  outlineColor: '#ff9900',
  outlineWidth: 2,
  insetWidth: 2,
  cursorEmoji: '📌',
  multiCursorEmoji: '📝',
  flashFontSize: 13,
  flashFontColor: '#ffffff',
  flashPause: 400,
  flashDuration: 1500,
  flashFallDistance: 80,
  cursorOffsetX: -6,
  cursorOffsetY: -6,
  facingX: 0,
  facingY: -1,
  facingBounds: 0,
  optionsFontSize: 14,
  optionsFontColor: '#000000',
  optionsBgColor: '#ffffff',
}

export type Settings = typeof SETTINGS_DEFAULTS
