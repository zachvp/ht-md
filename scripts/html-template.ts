import { SECTIONS } from '../src/options/definitions'
import type { SectionDef } from '../src/options/definitions'

type SectionCtx = {
  sectionId: string
  rowId: string
  label: string
  preview?: { id: string; styleAttr: string }
}

export function buildSectionMap(sections: SectionDef[]): Record<string, SectionCtx> {
  const map: Record<string, SectionCtx> = {}
  for (const s of sections) {
    const key = s.rowId.replace(/^row-/, '')
    map[key] = {
      sectionId: s.rowId.replace(/^row-/, 'section-'),
      rowId: s.rowId,
      label: s.label,
      ...(s.preview && {
        preview: {
          id: s.preview.id,
          styleAttr: s.preview.style ? ` style="${s.preview.style}"` : '',
        },
      }),
    }
  }
  return map
}

export function processTemplate(html: string, sectionMap: Record<string, SectionCtx>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (marker, path) => {
    const [key, ...rest] = path.split('.')
    const section = sectionMap[key]
    if (!section) throw new Error(`options.html: unknown section key '${key}' in '${marker}'`)
    let val: unknown = section
    for (const part of rest) val = (val as Record<string, unknown>)?.[part]
    if (val === undefined) throw new Error(`options.html: cannot resolve '${path}' in '${marker}'`)
    return String(val)
  })
}

export function validateTemplate(html: string): void {
  const sectionMap = buildSectionMap(SECTIONS)
  processTemplate(html, sectionMap)
}
