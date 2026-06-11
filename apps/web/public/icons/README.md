# PWA Icons

This directory must contain the PNG icon files referenced in `/public/manifest.json`.

## Required files

| File             | Size       | Usage                                   |
|------------------|------------|-----------------------------------------|
| `icon-72.png`    | 72×72 px   | Android home screen (small)             |
| `icon-96.png`    | 96×96 px   | Android home screen, shortcuts          |
| `icon-192.png`   | 192×192 px | Android splash screen, Apple touch icon |
| `icon-512.png`   | 512×512 px | Android splash screen (high-res), store |

## How to generate

Use the GoalForge SVG logo at `/public/icon.svg` as the source and export each
size as a PNG. Any of the following tools work:

- **Inkscape** (CLI): `inkscape icon.svg --export-filename=icon-512.png --export-width=512`
- **ImageMagick**: `convert -background none icon.svg -resize 512x512 icon-512.png`
- **pwa-asset-generator** (npm): `npx pwa-asset-generator icon.svg ./public/icons`
- Online: https://realfavicongenerator.net or https://maskable.app

## Maskable icons

All icons in `manifest.json` use `"purpose": "any maskable"`. For best results,
ensure the logo has at least 10% safe-zone padding on all sides so it looks good
when the OS clips it to a circle or squircle shape.
