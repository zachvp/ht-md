// Maximum browser z-index (2^31 - 1). Overlay is one below so cursor renders on top.
export const Z_TOP     = 2147483647
export const Z_OVERLAY = 2147483646
// Fallback badge z-index when no site nav z-index can be detected.
export const Z_BADGE   = 100000

// Prevents DarkReader from inverting injected <style> elements.
export const DARKREADER_CLASS = 'darkreader darkreader--sync'

// Inset box-shadow opacity, shared between hover overlay and selected CSS rule.
export const HIGHLIGHT_ALPHA = 0.35

// Consistent outline-offset for both hover overlay and selected rule.
export const OUTLINE_OFFSET = '1px'

// Pixel gap from element corner when positioning multi-select badges.
export const BADGE_INSET = 4

export const EXT_NAME = 'ht-md'

// CSS class names applied to page elements or injected nodes.
export const CLASS_SELECTED = `${EXT_NAME}-selected`
export const CLASS_HOVER    = `${EXT_NAME}-hover`
export const CLASS_BADGE    = `${EXT_NAME}-badge`
export const CLASS_FLASH    = `${EXT_NAME}-flash`
export const CLASS_CURSOR   = `${EXT_NAME}-cursor`
export const CLASS_OVERLAY  = `${EXT_NAME}-overlay`
