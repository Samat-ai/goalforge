import { describe, expect, it } from 'vitest'
import { BUCKET_ORDER, CAP_MESSAGE, bucketOf, fallbackTitle, isCapMessage, relTime, splitWords, usageRing } from '../coachView'

// Fixed epoch — bucketOf/relTime take `now` as an explicit param (purity gate), so no
// vi.setSystemTime is needed; every case below anchors to this constant directly.
const NOW = new Date('2026-07-12T12:00:00.000Z').getTime()
const DAY_MS = 86_400_000
const daysAgoIso = (days: number) => new Date(NOW - days * DAY_MS).toISOString()

describe('fallbackTitle', () => {
  it('uses the title when present, ignoring preview', () => {
    expect(fallbackTitle({ title: 'Half-marathon plan', preview: 'i want to run a marathon' }))
      .toEqual({ text: 'Half-marathon plan', fallback: false })
  })

  it('returns the preview verbatim at exactly 42 chars (no ellipsis)', () => {
    const preview = 'x'.repeat(42)
    expect(fallbackTitle({ title: null, preview })).toEqual({ text: preview, fallback: true })
  })

  it('truncates a preview over 42 chars, trimming trailing space before the ellipsis', () => {
    // chars 0-41 (42 total) are 41 x's + a trailing space; slice(0,42) keeps that space,
    // .trim() must drop it before the ellipsis is appended.
    const preview = 'x'.repeat(41) + ' ' + 'the rest of this message keeps going on'
    expect(fallbackTitle({ title: null, preview })).toEqual({ text: 'x'.repeat(41) + '…', fallback: true })
  })

  it("falls back to 'Intake session' when preview is null", () => {
    expect(fallbackTitle({ title: null, preview: null })).toEqual({ text: 'Intake session', fallback: true })
  })

  it("falls back to 'Intake session' when preview is omitted entirely", () => {
    expect(fallbackTitle({ title: null })).toEqual({ text: 'Intake session', fallback: true })
  })
})

describe('bucketOf', () => {
  it('buckets a 0.5-day-old session as Today', () => {
    expect(bucketOf(daysAgoIso(0.5), NOW)).toBe('Today')
  })

  it('buckets a 1.5-day-old session as Yesterday', () => {
    expect(bucketOf(daysAgoIso(1.5), NOW)).toBe('Yesterday')
  })

  it('buckets a 6-day-old session as Previous 7 days', () => {
    expect(bucketOf(daysAgoIso(6), NOW)).toBe('Previous 7 days')
  })

  it('buckets a 29-day-old session as Previous 30 days', () => {
    expect(bucketOf(daysAgoIso(29), NOW)).toBe('Previous 30 days')
  })

  it('buckets a 31-day-old session as Older', () => {
    expect(bucketOf(daysAgoIso(31), NOW)).toBe('Older')
  })

  it('BUCKET_ORDER lists every bucket in display order', () => {
    expect(BUCKET_ORDER).toEqual(['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older'])
  })
})

describe('relTime', () => {
  it('shows "just now" under a minute old', () => {
    expect(relTime(new Date(NOW - 30_000).toISOString(), NOW)).toBe('just now')
  })

  it('shows minutes for a 5-minute-old timestamp', () => {
    expect(relTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5m ago')
  })

  it('shows "yesterday" for a 26-hour-old timestamp', () => {
    expect(relTime(new Date(NOW - 26 * 3_600_000).toISOString(), NOW)).toBe('yesterday')
  })
})

describe('splitWords', () => {
  it('chunks words with their trailing whitespace attached', () => {
    expect(splitWords('Love it — pace, not pressure.'))
      .toEqual(['Love ', 'it ', '— ', 'pace, ', 'not ', 'pressure.'])
  })

  it('keeps multi-space and newline runs inside a chunk so the reveal reassembles verbatim', () => {
    const s = 'line one\n\nline two  spaced'
    expect(splitWords(s)).toEqual(['line ', 'one\n\n', 'line ', 'two  ', 'spaced'])
    expect(splitWords(s).join('')).toBe(s)
  })

  it('returns a single chunk for a single word', () => {
    expect(splitWords('hello')).toEqual(['hello'])
  })

  it('returns [] for empty and whitespace-only strings (callers skip the reveal)', () => {
    expect(splitWords('')).toEqual([])
    expect(splitWords('   ')).toEqual([])
  })
})

describe('CAP_MESSAGE / isCapMessage', () => {
  // Independent transcription check — pins the exact bytes against the backend source
  // (apps/api/services/coach_service.py::CAP_MESSAGE) so a mistyped/curly apostrophe or
  // any other drift fails loudly here instead of silently degrading the resting-Solly
  // cap moment to a plain bubble in the UI.
  it('matches the exact backend string verbatim', () => {
    expect(CAP_MESSAGE).toBe(
      "My forge needs to cool until tomorrow. We covered real ground today. Come back and we'll pick it up.",
    )
  })

  it('is true for an exact match', () => {
    expect(isCapMessage(CAP_MESSAGE)).toBe(true)
  })

  it('is false for a near-miss (trailing whitespace or edited text)', () => {
    expect(isCapMessage(CAP_MESSAGE + ' ')).toBe(false)
    expect(isCapMessage(CAP_MESSAGE.slice(0, -1))).toBe(false)
  })
})

describe('usageRing', () => {
  it('is hidden below half the allowance', () => {
    expect(usageRing(0, 20).visible).toBe(false)
    expect(usageRing(9, 20).visible).toBe(false)
  })

  it('becomes visible at exactly half', () => {
    const ring = usageRing(10, 20)
    expect(ring.visible).toBe(true)
    expect(ring.fraction).toBe(0.5)
    expect(ring.warn).toBe(false)
  })

  it('warns at 3 or fewer remaining', () => {
    expect(usageRing(16, 20).warn).toBe(false)
    expect(usageRing(17, 20).warn).toBe(true)
    expect(usageRing(20, 20)).toEqual({ visible: true, fraction: 0, warn: true })
  })

  it('clamps out-of-range input (over-cap sends are persisted server-side)', () => {
    expect(usageRing(25, 20)).toEqual({ visible: true, fraction: 0, warn: true })
    expect(usageRing(-1, 20).fraction).toBe(1)
  })

  it('degrades safely for a nonsense limit', () => {
    expect(usageRing(5, 0)).toEqual({ visible: false, fraction: 1, warn: false })
  })
})
