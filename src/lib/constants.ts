// Maximum browser z-index (2^31 - 1). Overlay is one below so cursor renders on top.
export const Z_TOP     = 2147483647
export const Z_OVERLAY = 2147483646

// Prevents DarkReader from inverting injected <style> elements.
export const DARKREADER_CLASS = 'darkreader darkreader--sync'

// Inset box-shadow opacity, shared between hover overlay and selected CSS rule.
export const HIGHLIGHT_ALPHA = 0.35

// Consistent outline-offset for both hover overlay and selected rule.
export const OUTLINE_OFFSET = '1px'

// Pixel gap from element corner when positioning multi-select badges.
export const BADGE_INSET = 4

// CSS class names applied to page elements or injected nodes.
export const CLASS_SELECTED = 'web-md-selected'
export const CLASS_BADGE    = 'web-md-badge'
export const CLASS_FLASH    = 'web-md-flash'
