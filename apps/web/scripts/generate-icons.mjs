/**
 * Generates PWA icon PNGs from public/icons/solly-logo.png using sharp.
 *
 * Usage:
 *   npm install sharp   (one-time, dev only)
 *   node scripts/generate-icons.mjs
 *
 * Output: public/icons/icon-{72,96,192,512}.png
 *
 * The source is the 540×540 Solly logo export (design_handoff_goalforge/
 * "Solly Visuals"/Solly logo.png, committed here since the handoff folder is
 * gitignored). Its rounded-rect artwork sits at (16,13) 512×512 with
 * transparent margins; we crop to that box and flatten the transparent
 * corners onto the artwork's own night-sky color so iOS (which renders
 * alpha as black) and maskable crops get a full-bleed square.
 */

import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ICONS_DIR = join(ROOT, 'public', 'icons')
const SRC_PATH = join(ICONS_DIR, 'solly-logo.png')
const ART_BOX = { left: 16, top: 13, width: 512, height: 512 }
const SKY = { r: 45, g: 44, b: 71 } // sampled from the logo's night sky (#2D2C47)
const SIZES = [72, 96, 192, 512]

mkdirSync(ICONS_DIR, { recursive: true })

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('sharp not installed. Run: npm install sharp')
  process.exit(1)
}

for (const size of SIZES) {
  const outPath = join(ICONS_DIR, `icon-${size}.png`)
  await sharp(SRC_PATH)
    .extract(ART_BOX)
    .flatten({ background: SKY })
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`  ✓ icon-${size}.png`)
}
