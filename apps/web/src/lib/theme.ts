import { useResolvedTheme, type ResolvedTheme } from './ThemeContext'

const FONTS = {
  display: "'Space Grotesk', sans-serif",
  body: "'Hanken Grotesk', sans-serif",
  serifAccent: "'Instrument Serif', serif",
  mono: "'JetBrains Mono', monospace",
} as const

// `serif` kept as an alias of `display` so the ~293 existing `T.serif`
// (heading/label) usages need no edits; body-copy sites are refined later in 1b.
export const DARK = {
  bg: '#08080f', surface: '#121220', card: '#121220',
  card2: '#16162a', cardHi: '#1a1a30',
  border: 'rgba(255,255,255,.07)', borderHi: 'rgba(255,255,255,.13)',
  orange: '#ff6a3d', indigo: '#818cf8', emerald: '#34d399',
  rose: '#fb7185', amber: '#fbbf24', muted: '#6b6c84',
  dim: '#3f3f5c', text: '#f1f1f7', textDim: '#abacc4',
  serif: FONTS.display, display: FONTS.display, body: FONTS.body,
  serifAccent: FONTS.serifAccent, mono: FONTS.mono,
} as const

// Light: semantic colors darkened for contrast on a light background.
export const LIGHT = {
  bg: '#edeff3', surface: '#f8f9fc', card: '#f8f9fc',
  card2: '#f2f4f8', cardHi: '#fbfcff',
  border: 'rgba(18,20,32,.07)', borderHi: 'rgba(18,20,32,.13)',
  orange: '#ff6a3d', indigo: '#5b5bd6', emerald: '#0a9d68',
  rose: '#e11d6b', amber: '#b8860b', muted: '#8a8c9b',
  dim: '#b4b6c4', text: '#14141d', textDim: '#565869',
  serif: FONTS.display, display: FONTS.display, body: FONTS.body,
  serifAccent: FONTS.serifAccent, mono: FONTS.mono,
} as const

export type Palette = typeof DARK

// Back-compat static export (dark). Migrated components use `useT()` instead.
export const T: Palette = DARK

export function getPalette(theme: ResolvedTheme): Palette {
  return theme === 'light' ? LIGHT : DARK
}

export function useT(): Palette {
  return getPalette(useResolvedTheme())
}
