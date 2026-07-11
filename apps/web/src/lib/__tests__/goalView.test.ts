import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toGoalView } from '../goalView'
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
