import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const TEAL   = '#4DD0E1'
const ORANGE = '#FF9900'
const BG     = '#FFFFFF'

// Segments: array of { text, color } — color defaults to black if not teal/orange
// Parse a string like "<html> → #md" into colored spans.
// Rules: tokens starting with '<' or containing '<' get teal; tokens starting with '#' get orange.
function tokenize(text: string): { text: string; color: string }[] {
  const tokens: { text: string; color: string }[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '<') {
      // consume until '>' or end
      const end = text.indexOf('>', i)
      const raw = end === -1 ? text.slice(i) : text.slice(i, end + 1)
      tokens.push({ text: raw, color: TEAL })
      i += raw.length
    } else if (ch === '#') {
      // consume word chars after #
      let j = i + 1
      while (j < text.length && /\S/.test(text[j])) j++
      tokens.push({ text: text.slice(i, j), color: ORANGE })
      i = j
    } else {
      // consume until next < or #
      let j = i + 1
      while (j < text.length && text[j] !== '<' && text[j] !== '#') j++
      tokens.push({ text: text.slice(i, j), color: '#000000' })
      i = j
    }
  }
  return tokens
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function makeSvg(text: string, width: number, height: number): Buffer {
  const tokens = tokenize(text)
  // Font size: fit text to ~80% of width, estimate char width as ~0.6 * fontSize
  const charCount = text.length
  const maxFs = Math.round(height * 0.45)
  const fsByWidth = Math.round((width * 0.80) / (charCount * 0.60))
  const fs = Math.min(maxFs, fsByWidth)

  const spans = tokens
    .map(t => `<tspan fill="${t.color}">${escape(t.text)}</tspan>`)
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${BG}"/>` +
    `<text x="${width / 2}" y="${height / 2}" ` +
    `font-family="Menlo,'Courier New',monospace" font-size="${fs}" ` +
    `text-anchor="middle" dominant-baseline="central">` +
    spans +
    `</text></svg>`

  return Buffer.from(svg)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }
  const text   = get('--text')
  const width  = parseInt(get('--width')  ?? '440', 10)
  const height = parseInt(get('--height') ?? '280', 10)
  const out    = get('--out') ?? resolve(__dirname, `../icons/promo_${width}x${height}.png`)
  if (!text) {
    console.error('Usage: gen-promo --text "<html> → #md" [--width 440] [--height 280] [--out path.png]')
    process.exit(1)
  }
  return { text, width, height, out }
}

async function main() {
  const { text, width, height, out } = parseArgs()
  mkdirSync(resolve(out, '..'), { recursive: true })
  await sharp(makeSvg(text, width, height)).png().toFile(out)
  console.log(`  ${out}`)
}

main()
