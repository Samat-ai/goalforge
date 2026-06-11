/**
 * Generates PWA icon PNGs from public/icon.svg using sharp.
 *
 * Usage:
 *   npm install sharp   (one-time, dev only)
 *   node scripts/generate-icons.mjs
 *
 * Output: public/icons/icon-{72,96,192,512}.png
 */

import { mkdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ICONS_DIR = join(ROOT, 'public', 'icons')
const SVG_PATH = join(ROOT, 'public', 'icon.svg')
const SIZES = [72, 96, 192, 512]

mkdirSync(ICONS_DIR, { recursive: true })

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('sharp not installed. Run: npm install sharp')
  process.exit(1)
}

const svg = readFileSync(SVG_PATH)

for (const size of SIZES) {
  const outPath = join(ICONS_DIR, `icon-${size}.png`)
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`  ✓ icon-${size}.png`)
}

console.log(`\nIcons written to apps/web/public/icons/ — commit them to the repo.`)
