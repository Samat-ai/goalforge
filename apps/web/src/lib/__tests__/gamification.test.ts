import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bestStreak,
  dayDiff,
  daysAgo,
  habitStrength,
  lastStreakLength,
  streak,
  todayStr,
} from '../gamification'

// Freeze "now" at local noon so todayStr() is stable in any machine timezone.
const FIXED_NOW = new Date(2026, 6, 10, 12, 0, 0) // 2026-07-10

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('date helpers', () => {
  it('todayStr formats the frozen date as YYYY-MM-DD', () => {
    expect(todayStr()).toBe('2026-07-10')
  })

  it('daysAgo walks backwards across month boundaries', () => {
    expect(daysAgo('2026-07-10', 1)).toBe('2026-07-09')
    expect(daysAgo('2026-03-01', 1)).toBe('2026-02-28')
  })

  it('dayDiff counts whole days and clamps negatives to 0', () => {
    expect(dayDiff('2026-07-01', '2026-07-10')).toBe(9)
    expect(dayDiff('2026-07-10', '2026-07-01')).toBe(0)
  })
})

describe('streak', () => {
  it('returns 0 for no history', () => {
    expect(streak([])).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    expect(streak(['2026-07-08', '2026-07-09', '2026-07-10'])).toBe(3)
  })

  it('is 0 when today has no completion', () => {
    expect(streak(['2026-07-09'])).toBe(0)
  })

  it('stops at the first gap', () => {
    expect(streak(['2026-07-10', '2026-07-08'])).toBe(1)
  })

  it('ignores future dates instead of breaking the walk', () => {
    expect(streak(['2026-07-11', '2026-07-10', '2026-07-09'])).toBe(2)
  })
})

describe('lastStreakLength', () => {
  it('is 0 while a streak is active', () => {
    expect(lastStreakLength(['2026-07-10'])).toBe(0)
  })

  it('measures the most recently broken streak', () => {
    expect(lastStreakLength(['2026-07-07', '2026-07-08'])).toBe(2)
  })

  it('is 0 with no history', () => {
    expect(lastStreakLength([])).toBe(0)
  })
})

describe('bestStreak', () => {
  it('finds the longest run anywhere in history', () => {
    expect(
      bestStreak(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07']),
    ).toBe(3)
  })

  it('does not double-count duplicate dates', () => {
    expect(bestStreak(['2026-07-01', '2026-07-01', '2026-07-02'])).toBe(2)
  })
})

describe('habitStrength', () => {
  it('is 0 with no history', () => {
    expect(habitStrength([])).toBe(0)
  })

  it('is exactly one gain for a single completion today', () => {
    expect(habitStrength(['2026-07-10'])).toBeCloseTo(0.15, 5)
  })

  it('approaches 1 after 30 consecutive days', () => {
    const days = Array.from({ length: 30 }, (_, i) => daysAgo('2026-07-10', i))
    const strength = habitStrength(days)
    expect(strength).toBeGreaterThan(0.98)
    expect(strength).toBeLessThanOrEqual(1)
  })

  it('has almost fully decayed for one completion 29 days ago', () => {
    const strength = habitStrength([daysAgo('2026-07-10', 29)])
    expect(strength).toBeGreaterThan(0)
    expect(strength).toBeLessThan(0.01)
  })
})
