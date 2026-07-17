import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daysSinceLastActivity, goalIsDying, toGoalView } from '../goalView'
import { makeGoal, makeMilestone, makeTask } from './factories'

const FIXED_NOW = new Date(2026, 6, 10, 12, 0, 0) // 2026-07-10
const TODAY = '2026-07-10'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('toGoalView', () => {
  it('derives progress from milestone completion', () => {
    const goal = makeGoal({
      milestones: [
        makeMilestone({ is_completed: true }),
        makeMilestone({ is_completed: true }),
        makeMilestone(),
        makeMilestone(),
      ],
    })
    expect(toGoalView(goal).progress).toBe(50)
  })

  it('falls back to goal.progress when there are no milestones', () => {
    const goal = makeGoal({ milestones: [], progress: 33 })
    expect(toGoalView(goal).progress).toBe(33)
  })

  it('splits tasks into today (by position) and overdue (by date, then position)', () => {
    const todayB = makeTask({ assigned_date: TODAY, position: 1 })
    const todayA = makeTask({ assigned_date: TODAY, position: 0 })
    const oldDone = makeTask({ assigned_date: '2026-07-08', is_completed: true })
    const older = makeTask({ assigned_date: '2026-07-07' })
    const newer = makeTask({ assigned_date: '2026-07-09' })
    const future = makeTask({ assigned_date: '2026-07-12' })
    const view = toGoalView(
      makeGoal({ daily_tasks: [todayB, todayA, oldDone, older, newer, future] }),
    )

    expect(view.tasks.map(t => t.id)).toEqual([todayA.id, todayB.id])
    // Overdue: incomplete past tasks only, oldest first; completed + future excluded
    expect(view.overdue.map(t => t.id)).toEqual([older.id, newer.id])
  })

  it('formats the deadline relative to today', () => {
    expect(toGoalView(makeGoal({ target_date: '2026-07-09' })).deadline).toBe('overdue')
    expect(toGoalView(makeGoal({ target_date: TODAY })).deadline).toBe('today')
    expect(toGoalView(makeGoal({ target_date: '2026-07-11' })).deadline).toBe('tomorrow')

    const soon = toGoalView(makeGoal({ target_date: '2026-07-20' }))
    expect(soon.deadline).toBe('10d left')
    expect(soon.deadlineKind).toBe('soon')

    const far = toGoalView(makeGoal({ target_date: '2026-09-01' }))
    expect(far.deadlineKind).toBe('ok')
  })

  it('shows achieved goals as done at full brightness', () => {
    const view = toGoalView(makeGoal({ status: 'achieved', target_date: '2026-07-01' }))
    expect(view.deadline).toBe('done')
    expect(view.brightness).toBe(1)
  })

  it('maps milestone sprint_status to view status', () => {
    const view = toGoalView(
      makeGoal({
        milestones: [
          makeMilestone({ position: 1, is_completed: true, sprint_status: 'completed' }),
          makeMilestone({ position: 2, sprint_status: 'failed' }),
          makeMilestone({ position: 3, sprint_status: 'generating' }),
          makeMilestone({ position: 4, sprint_status: 'pending' }),
        ],
      }),
    )
    expect(view.milestones.map(m => m.status)).toEqual([
      'completed',
      'failed',
      'active',
      'upcoming',
    ])
  })
})

describe('daysSinceLastActivity', () => {
  it('uses the latest completed day when completions exist', () => {
    const goal = makeGoal({
      created_at: '2026-06-01T00:00:00Z',
      completed_days: ['2026-07-01', '2026-07-05'],
    })
    expect(daysSinceLastActivity(goal)).toBe(5)
  })

  it('falls back to created_at when there are no completions', () => {
    const goal = makeGoal({ created_at: '2026-06-20T00:00:00Z', completed_days: [] })
    expect(daysSinceLastActivity(goal)).toBe(20)
  })

  it('ignores future-dated completed days', () => {
    const goal = makeGoal({
      created_at: '2026-07-01T00:00:00Z',
      completed_days: ['2026-07-15'],
    })
    expect(daysSinceLastActivity(goal)).toBe(9)
  })
})

describe('goalIsDying / isFaded', () => {
  it('marks a long-idle zero-completion goal as dying', () => {
    const goal = makeGoal({ created_at: '2026-06-01T00:00:00Z', completed_days: [] })
    expect(goalIsDying(goal)).toBe(true)
    expect(toGoalView(goal).isDying).toBe(true)
  })

  it('marks a goal with one stale completion as dying (brightness ~0.006)', () => {
    const goal = makeGoal({
      created_at: '2026-06-01T00:00:00Z',
      completed_days: ['2026-06-20'],
    })
    expect(goalIsDying(goal)).toBe(true)
  })

  it('gives brand-new goals a 7-day grace period', () => {
    const goal = makeGoal({ created_at: '2026-07-08T00:00:00Z', completed_days: [] })
    expect(goalIsDying(goal)).toBe(false)
  })

  it('does not mark goals whose brightness is above the floor', () => {
    // 10 consecutive completions ending 8 idle days ago -> brightness ~0.27
    const goal = makeGoal({
      created_at: '2026-06-01T00:00:00Z',
      completed_days: ['2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27',
        '2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02'],
    })
    expect(goalIsDying(goal)).toBe(false)
  })

  it('never marks achieved or abandoned goals as dying', () => {
    const base = { created_at: '2026-06-01T00:00:00Z', completed_days: [] as string[] }
    expect(goalIsDying(makeGoal({ ...base, status: 'achieved' }))).toBe(false)
    expect(goalIsDying(makeGoal({ ...base, status: 'abandoned' }))).toBe(false)
  })

  it('flags abandoned goals as faded only after 30 idle days', () => {
    const faded = toGoalView(
      makeGoal({ status: 'abandoned', created_at: '2026-06-01T00:00:00Z', completed_days: [] }),
    )
    expect(faded.isFaded).toBe(true)

    const recent = toGoalView(
      makeGoal({ status: 'abandoned', created_at: '2026-06-01T00:00:00Z', completed_days: ['2026-06-30'] }),
    )
    expect(recent.isFaded).toBe(false)
  })

  it('never flags active goals as faded', () => {
    const view = toGoalView(
      makeGoal({ status: 'active', created_at: '2026-06-01T00:00:00Z', completed_days: [] }),
    )
    expect(view.isFaded).toBe(false)
  })
})
