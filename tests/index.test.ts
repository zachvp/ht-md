import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import Ajv from 'ajv'
import { SECTIONS, type FieldDef } from '../src/options/definitions'
import { buildSectionMap, processTemplate } from '../scripts/html-template'

// ── Schema ────────────────────────────────────────────────────────────────────

const ajv = new Ajv({ allErrors: true })

const sectionsSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['rowId', 'label', 'fields'],
    properties: {
      rowId:   { type: 'string', pattern: '^row-' },
      label:   { type: 'string', minLength: 1 },
      preview: {
        type: 'object',
        required: ['id'],
        properties: {
          id:    { type: 'string', minLength: 1 },
          style: { type: 'string' },
        },
        additionalProperties: false,
      },
      fields: { type: 'array', minItems: 1 },
    },
    additionalProperties: false,
  },
}

// Flattens toggle-groups into their constituent fields
function allFields(fields: FieldDef[]): FieldDef[] {
  return fields.flatMap(f =>
    f.type === 'toggle-group' ? [f.toggle, ...allFields(f.params)] : [f]
  )
}

// ── definitions ───────────────────────────────────────────────────────────────

describe('definitions', () => {
  test('SECTIONS validates against schema', () => {
    const validate = ajv.compile(sectionsSchema)
    if (!validate(SECTIONS)) {
      assert.fail(`Schema errors:\n${ajv.errorsText(validate.errors)}`)
    }
  })

  test('all field IDs are unique', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const section of SECTIONS) {
      for (const f of allFields(section.fields)) {
        if (f.type === 'plane') continue
        if (seen.has(f.id)) dupes.push(f.id)
        seen.add(f.id)
      }
    }
    assert.deepEqual(dupes, [])
  })

  test('number field defaults are within [min, max]', () => {
    for (const section of SECTIONS) {
      for (const f of allFields(section.fields)) {
        if (f.type !== 'number') continue
        assert.ok(
          f.default >= f.min && f.default <= f.max,
          `${f.id}: default ${f.default} out of [${f.min}, ${f.max}]`
        )
      }
    }
  })

  test('color field defaults are valid hex strings', () => {
    const hex = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/
    for (const section of SECTIONS) {
      for (const f of allFields(section.fields)) {
        if (f.type !== 'color') continue
        assert.match(f.default, hex, `${f.id}: '${f.default}' is not a hex color`)
      }
    }
  })
})

// ── html-template ─────────────────────────────────────────────────────────────

describe('html-template', () => {
  const map = buildSectionMap(SECTIONS)

  test('buildSectionMap keys strip row- prefix', () => {
    for (const section of SECTIONS) {
      const key = section.rowId.replace(/^row-/, '')
      assert.ok(key in map, `missing key '${key}'`)
    }
  })

  test('buildSectionMap sectionId uses section- prefix', () => {
    for (const [key, ctx] of Object.entries(map)) {
      assert.equal(ctx.sectionId, `section-${key}`)
    }
  })

  test('buildSectionMap includes preview when section has one', () => {
    for (const section of SECTIONS.filter(s => s.preview)) {
      const key = section.rowId.replace(/^row-/, '')
      assert.ok(map[key].preview, `missing preview for '${key}'`)
      assert.equal(map[key].preview!.id, section.preview!.id)
    }
  })

  test('buildSectionMap omits preview when section has none', () => {
    for (const section of SECTIONS.filter(s => !s.preview)) {
      const key = section.rowId.replace(/^row-/, '')
      assert.equal(map[key].preview, undefined)
    }
  })

  test('processTemplate replaces a marker', () => {
    const key = SECTIONS[0].rowId.replace(/^row-/, '')
    assert.equal(processTemplate(`{{${key}.rowId}}`, map), SECTIONS[0].rowId)
  })

  test('processTemplate replaces multiple markers', () => {
    const key = SECTIONS[0].rowId.replace(/^row-/, '')
    const result = processTemplate(`{{${key}.rowId}} {{${key}.label}}`, map)
    assert.equal(result, `${SECTIONS[0].rowId} ${SECTIONS[0].label}`)
  })

  test('processTemplate throws on unknown section key', () => {
    assert.throws(() => processTemplate('{{nope.rowId}}', map), /unknown section key/)
  })

  test('processTemplate throws on unresolvable path', () => {
    const key = SECTIONS[0].rowId.replace(/^row-/, '')
    assert.throws(() => processTemplate(`{{${key}.nope}}`, map), /cannot resolve/)
  })
})
