import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const TEAL   = '#4DD0E1'
const ORANGE = '#FF9900'
const BG     = '#FFFFFF'

// Monospace char width ratio (Menlo/Courier)
const CHAR_W_RATIO = 0.601

type Token = { text: string; color: string }

// Tokenize by character so spaces are preserved as grid cells.
// Each character is its own token; adjacent same-color chars are merged for compact SVG output.
function tokenize(text: string, neutralColor: string): Token[] {
  const chars: Token[] = text.split('').map(ch => {
    if (ch === ' ') return { text: ch, color: neutralColor }
    // We can't know mid-stream whether we're inside a <...> block from single chars,
    // so track state with a small pass.
    return { text: ch, color: neutralColor }
  })
  // Two-pass: first mark teal ranges (<...>), then orange runs (#word).
  const result: Token[] = text.split('').map(ch => ({ text: ch, color: neutralColor }))
  let i = 0
  while (i < text.length) {
    if (text[i] === '<') {
      const end = text.indexOf('>', i)
      const stop = end === -1 ? text.length : end + 1
      for (let j = i; j < stop; j++) result[j].color = TEAL
      i = stop
    } else if (text[i] === '#') {
      let j = i + 1
      while (j < text.length && /\S/.test(text[j])) j++
      for (let k = i; k < j; k++) result[k].color = ORANGE
      i = j
    } else {
      i++
    }
  }
  // Merge adjacent same-color tokens
  return result.reduce<Token[]>((acc, tok) => {
    const last = acc[acc.length - 1]
    if (last && last.color === tok.color) {
      last.text += tok.text
    } else {
      acc.push({ ...tok })
    }
    return acc
  }, [])
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function makeSvg(text: string, width: number, height: number, neutralColor: string): Buffer {
  const tokens = tokenize(text, neutralColor)
  const charCount = text.length
  const maxFs = Math.round(height * 0.45)
  const fsByWidth = Math.round((width * 0.80) / (charCount * CHAR_W_RATIO))
  const fs = Math.min(maxFs, fsByWidth)

  // Place text on a monospace grid: compute total text width and center it.
  // Each character occupies exactly fs * CHAR_W_RATIO px.
  const cellW = fs * CHAR_W_RATIO
  const totalW = charCount * cellW
  const startX = (width - totalW) / 2 + cellW / 2

  // Build tspan elements with explicit x positions per character group.
  // We walk through merged tokens, tracking the running char offset.
  let charOffset = 0
  const spans: string[] = []
  for (const tok of tokens) {
    const x = startX + charOffset * cellW
    // For multi-char tokens, list x positions for each char (monospace grid).
    const xs = Array.from({ length: tok.text.length }, (_, k) =>
      (x + k * cellW).toFixed(2)
    ).join(' ')
    spans.push(
      `<tspan fill="${tok.color}" x="${xs}">${escape(tok.text)}</tspan>`
    )
    charOffset += tok.text.length
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${BG}"/>` +
    `<text y="${height / 2}" ` +
    `font-family="Menlo,'Courier New',monospace" font-size="${fs}" ` +
    `dominant-baseline="central">` +
    spans.join('') +
    `</text></svg>`

  return Buffer.from(svg)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }
  const text         = get('--text')
  const width        = parseInt(get('--width')        ?? '440',     10)
  const height       = parseInt(get('--height')       ?? '280',     10)
  const neutralColor = get('--arrow-color')           ?? '#000000'
  const out          = get('--out') ?? resolve(__dirname, `../icons/promo_${width}x${height}.png`)
  if (!text) {
    console.error(
      'Usage: gen-promo --text "<html> → #md" [--width 440] [--height 280] ' +
      '[--arrow-color #888888] [--out path.png]'
    )
    process.exit(1)
  }
  return { text, width, height, neutralColor, out }
}

async function main() {
  const { text, width, height, neutralColor, out } = parseArgs()
  mkdirSync(resolve(out, '..'), { recursive: true })
  await sharp(makeSvg(text, width, height, neutralColor)).png().toFile(out)
  console.log(`  ${out}`)
}

main()
