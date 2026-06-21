import { readFileSync, writeFileSync, rmSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SECTIONS, ADVANCED_FIELDS } from '../src/options/definitions'
import type { FieldDef } from '../src/options/definitions'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const FIELD_TYPE_TO_TAG: Partial<Record<FieldDef['type'], keyof HTMLElementTagNameMap>> = {
  number:   'input',
  color:    'input',
  checkbox: 'input',
  emoji:    'button',
  keybind:  'button',
}

const TAG_TO_HTML_TYPE: Partial<Record<keyof HTMLElementTagNameMap, string>> = {
  input:    'HTMLInputElement',
  button:   'HTMLButtonElement',
  div:      'HTMLDivElement',
  span:     'HTMLSpanElement',
  textarea: 'HTMLTextAreaElement',
  p:        'HTMLParagraphElement',
  select:   'HTMLSelectElement',
}

function htmlType(tag: keyof HTMLElementTagNameMap): string {
  return TAG_TO_HTML_TYPE[tag] ?? 'HTMLElement'
}

const allFields = [...SECTIONS.flatMap(s => s.fields), ...ADVANCED_FIELDS]

// --- options-elements.generated.ts ---

const fieldEntries: Array<{ id: string; tag: keyof HTMLElementTagNameMap }> = []

for (const f of allFields) {
  if (f.type === 'plane') {
    for (const entry of f.ids) fieldEntries.push(entry)
  } else {
    const tag = FIELD_TYPE_TO_TAG[f.type]
    if (tag) fieldEntries.push({ id: f.id, tag })
  }
}

const fieldIds = new Set(fieldEntries.map(e => e.id))
const html = readFileSync(resolve(root, 'options.html'), 'utf8')
const staticEntries: Array<{ id: string; tag: keyof HTMLElementTagNameMap }> = []

const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/
for (const match of html.matchAll(/<(\w+)[^>]*\sid="([^"]+)"/g)) {
  const [, tag, id] = match
  if (!fieldIds.has(id) && validIdentifier.test(id)) {
    staticEntries.push({ id, tag: tag.toLowerCase() as keyof HTMLElementTagNameMap })
  }
}

const allEntries = [...fieldEntries, ...staticEntries]
const maxIdLen = Math.max(...allEntries.map(e => e.id.length))

const elLines = allEntries.map(({ id, tag }) => {
  const padded = id.padEnd(maxIdLen)
  return `  get ${padded}() { return document.getElementById('${id}') as ${htmlType(tag)} },`
})

writeFileSync(resolve(root, 'src/options/elements.generated.ts'), `export const els = {
${elLines.join('\n')}
}
`)
console.log(`wrote src/options/elements.generated.ts (${allEntries.length} entries)`)

// --- settings.generated.ts ---

const storageEntries: Array<{ key: string; default: unknown }> = []

for (const f of allFields) {
  if (f.type === 'plane') {
    for (const s of f.storage) storageEntries.push(s)
  } else if (f.type === 'emoji') {
    storageEntries.push({ key: f.storageKey, default: f.default })
  } else {
    storageEntries.push({ key: f.id, default: f.default })
  }
}

const maxKeyLen = Math.max(...storageEntries.map(e => e.key.length))

const settingsLines = storageEntries.map(({ key, default: val }) => {
  const padded = key.padEnd(maxKeyLen)
  const serialized = typeof val === 'string' ? `'${val}'` : String(val)
  return `  ${padded}: ${serialized},`
})

writeFileSync(resolve(root, 'src/lib/settings.generated.ts'), `export const SETTINGS_DEFAULTS = {
${settingsLines.join('\n')}
}

export type Settings = typeof SETTINGS_DEFAULTS
`)
console.log(`wrote src/lib/settings.generated.ts (${storageEntries.length} keys)`)

// Remove old non-suffixed files if they exist
for (const old of ['src/options-elements.ts', 'src/options-elements.generated.ts', 'src/lib/settings.ts']) {
  const p = resolve(root, old)
  if (existsSync(p)) { rmSync(p); console.log(`removed ${old}`) }
}
