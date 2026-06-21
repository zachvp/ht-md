import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../icons')

const SIZES = [16, 48, 128]
const TEAL   = '#4DD0E1'
const ORANGE = '#FF9900'

function makeSvg(size: number): Buffer {
  const fs = Math.round(size * 0.72)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<text x="${size / 2}" y="${size / 2}" ` +
    `font-family="Menlo,'Courier New',monospace" font-size="${fs}" ` +
    `text-anchor="middle" dominant-baseline="central">` +
    `<tspan fill="${TEAL}">&lt;</tspan>` +
    `<tspan fill="${ORANGE}">#</tspan>` +
    `</text></svg>`
  return Buffer.from(svg)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const size of SIZES) {
    const out = resolve(OUT_DIR, `icon${size}.png`)
    await sharp(makeSvg(size)).png().toFile(out)
    console.log(`  ${out}`)
  }
}

main()
