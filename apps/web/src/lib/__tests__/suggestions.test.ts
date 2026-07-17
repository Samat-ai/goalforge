import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickSuggestion, snoozeKey, SUGGEST_SNOOZE_MS, type SnoozeState } from '../suggestions'
import { makeGoal, makeTask } from './factories'
import type { Goal } from '../types'

// pickSuggestion takes `now` explicitly, but goalIsDying/pickOneThing underneath
// read the module clock via todayStr() — pin both to the same instant.
const AT_15 = new Date(2026, 6, 10, 15, 0, 0) // 2026-07-10 15:00 local
const AT_10 = new Date(2026, 6, 10, 10, 0, 0)
const TODAY = '2026-07-10'
const FRESH = '2026-07-08T00:00:00Z' // 2 idle days — safely outside the dying window

const NO_SNOOZE: SnoozeState = { energy: null, focus: null }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AT_15)
})
afterEach(() => {
  vi.useRealTimers()
})

/** Goal with N incomplete today-tasks; recent created_at so it is never dying. */
function energyGoal(over: Partial<Goal> = {}): Goal {
  return makeGoal({
    created_at: FRESH,
    daily_tasks: [
      makeTask({ assigned_date: TODAY, position: 0 }),
      makeTask({ assigned_date: TODAY, position: 1 }),
      makeTask({ assigned_date: TODAY, position: 2 }),
    ],
    ...over,
  })
}

describe('pickSuggestion — energy', () => {
  it('fires in the afternoon with 3+ pending unresized tasks and nothing done', () => {
    const s = pickSuggestion([energyGoal()], AT_15, NO_SNOOZE)
    expect(s?.type).toBe('energy')
    expect(s?.title).toBeTruthy()
    expect(s?.cta).toBeTruthy()
  })

  it('stays silent before 14:00 (energy is a rough-day signal)', () => {
    vi.setSystemTime(AT_10)
    expect(pickSuggestion([energyGoal()], AT_10, NO_SNOOZE)).toBeNull()
  })

  it('stays silent once anything was completed today', () => {
    const goal = energyGoal({
      daily_tasks: [
        makeTask({ assigned_date: TODAY, is_completed: true }),
        makeTask({ assigned_date: TODAY }),
        makeTask({ assigned_date: TODAY }),
        makeTask({ assigned_date: TODAY }),
      ],
      completed_days: [TODAY],
    })
    expect(pickSuggestion([goal], AT_15, NO_SNOOZE)).toBeNull()
  })

  it('needs something left to resize — already-resized days fall through to focus', () => {
    const resized = { original_description: 'orig', original_tip: 'orig tip' }
    const goal = energyGoal({
      daily_tasks: [
        makeTask({ assigned_date: TODAY, ...resized }),
        makeTask({ assigned_date: TODAY, ...resized }),
        makeTask({ assigned_date: TODAY, ...resized }),
        makeTask({ assigned_date: '2026-07-08' }),
        makeTask({ assigned_date: '2026-07-09' }),
      ],
    })
    const s = pickSuggestion([goal], AT_15, NO_SNOOZE)
    expect(s?.type).toBe('focus') // 5 actionable, energy has no target
  })
})

describe('pickSuggestion — focus', () => {
  it('fires any time of day with 5+ actionable tasks and nothing done', () => {
    vi.setSystemTime(AT_10)
    const goal = energyGoal({
      daily_tasks: [
        makeTask({ assigned_date: TODAY }),
        makeTask({ assigned_date: TODAY }),
        makeTask({ assigned_date: TODAY }),
        makeTask({ assigned_date: '2026-07-08' }),
        makeTask({ assigned_date: '2026-07-09' }),
      ],
    })
    const s = pickSuggestion([goal], AT_10, NO_SNOOZE)
    expect(s?.type).toBe('focus')
  })

  it('needs at least 5 actionable tasks', () => {
    vi.setSystemTime(AT_10)
    const goal = energyGoal({
      daily_tasks: [
        makeTask({ assigned_date: TODAY }),
        makeTask({ assigned_date: TODAY }),
        makeTask({ assigned_date: TODAY }),
        makeTask({ assigned_date: '2026-07-09' }),
      ],
    })
    expect(pickSuggestion([goal], AT_10, NO_SNOOZE)).toBeNull()
  })

  it('yields to energy when both are eligible (priority)', () => {
    const goal = energyGoal({
      daily_tasks: Array.from({ length: 5 }, (_, i) =>
        makeTask({ assigned_date: TODAY, position: i })),
    })
    expect(pickSuggestion([goal], AT_15, NO_SNOOZE)?.type).toBe('energy')
  })
})

describe('pickSuggestion — suppression & scope', () => {
  it('returns null while any active goal is in rescue mode', () => {
    const rescue = makeGoal({ created_at: FRESH, rescue_mode: true })
    expect(pickSuggestion([energyGoal(), rescue], AT_15, NO_SNOOZE)).toBeNull()
  })

  it('returns null while any active goal is dying', () => {
    const dying = makeGoal({ created_at: '2026-06-01T00:00:00Z', completed_days: [] })
    expect(pickSuggestion([energyGoal(), dying], AT_15, NO_SNOOZE)).toBeNull()
  })

  it('ignores achieved and abandoned goals entirely', () => {
    const achieved = energyGoal({ status: 'achieved' })
    const abandoned = energyGoal({ status: 'abandoned', created_at: '2026-06-01T00:00:00Z' })
    expect(pickSuggestion([achieved, abandoned], AT_15, NO_SNOOZE)).toBeNull()
  })
})

describe('pickSuggestion — snooze', () => {
  it('respects a fresh snooze and falls through to the next suggestion', () => {
    const oneHourAgo = AT_15.getTime() - 60 * 60 * 1000
    const goal = energyGoal({
      daily_tasks: Array.from({ length: 5 }, (_, i) =>
        makeTask({ assigned_date: TODAY, position: i })),
    })
    const s = pickSuggestion([goal], AT_15, { energy: oneHourAgo, focus: null })
    expect(s?.type).toBe('focus')

    const both = pickSuggestion([goal], AT_15, { energy: oneHourAgo, focus: oneHourAgo })
    expect(both).toBeNull()
  })

  it('lets an expired snooze fire again', () => {
    const past = AT_15.getTime() - SUGGEST_SNOOZE_MS - 60 * 60 * 1000
    const s = pickSuggestion([energyGoal()], AT_15, { energy: past, focus: null })
    expect(s?.type).toBe('energy')
  })
})

describe('pickSuggestion — copy', () => {
  it('is deterministic for a fixed date', () => {
    const a = pickSuggestion([energyGoal()], AT_15, NO_SNOOZE)
    const b = pickSuggestion([energyGoal()], AT_15, NO_SNOOZE)
    expect(a).toEqual(b)
    expect(a?.body).toBeTruthy()
  })
})

describe('snoozeKey', () => {
  it('namespaces per suggestion type', () => {
    expect(snoozeKey('energy')).toBe('gf_suggest_snooze_energy')
    expect(snoozeKey('focus')).toBe('gf_suggest_snooze_focus')
  })
})
