import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickOneThing } from '../pickOneThing'
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

describe('pickOneThing', () => {
  it('returns null when there are no goals', () => {
    expect(pickOneThing([])).toBeNull()
  })

  it('excludes future tasks entirely (anti-exploit rule)', () => {
    const goal = makeGoal({
      daily_tasks: [makeTask({ assigned_date: '2026-07-12' })],
    })
    expect(pickOneThing([goal])).toBeNull()
  })

  it('prefers a today task over an overdue task', () => {
    const overdue = makeTask({ assigned_date: '2026-07-05' })
    const today = makeTask({ assigned_date: TODAY })
    const goal = makeGoal({ daily_tasks: [overdue, today] })
    expect(pickOneThing([goal])?.task.id).toBe(today.id)
  })

  it("prefers a rescue task assigned today over everything else", () => {
    const today = makeTask({ assigned_date: TODAY })
    const rescue = makeTask({ assigned_date: TODAY, is_rescue_task: true })
    const goal = makeGoal({ daily_tasks: [today, rescue] })
    expect(pickOneThing([goal])?.task.id).toBe(rescue.id)
  })

  it('among overdue tasks, prefers the one more days late', () => {
    const slightlyLate = makeTask({ assigned_date: '2026-07-09' })
    const veryLate = makeTask({ assigned_date: '2026-07-01' })
    const goal = makeGoal({ daily_tasks: [slightlyLate, veryLate] })
    expect(pickOneThing([goal])?.task.id).toBe(veryLate.id)
  })

  it('an extremely overdue task still never outranks a today task', () => {
    const ancient = makeTask({ assigned_date: '2024-01-01' })
    const today = makeTask({ assigned_date: TODAY })
    const goal = makeGoal({ daily_tasks: [ancient, today] })
    expect(pickOneThing([goal])?.task.id).toBe(today.id)
  })

  it('skips completed tasks, inactive goals, and goals without an active milestone', () => {
    const doneToday = makeGoal({
      daily_tasks: [makeTask({ assigned_date: TODAY, is_completed: true })],
    })
    const abandoned = makeGoal({
      status: 'abandoned',
      daily_tasks: [makeTask({ assigned_date: TODAY })],
    })
    const noActiveSprint = makeGoal({
      milestones: [makeMilestone({ sprint_status: 'pending' })],
      daily_tasks: [makeTask({ assigned_date: TODAY })],
    })
    expect(pickOneThing([doneToday, abandoned, noActiveSprint])).toBeNull()
  })

  it('skips rescue-mode goals until their rescue tasks exist for today', () => {
    const stalled = makeGoal({
      rescue_mode: true,
      daily_tasks: [makeTask({ assigned_date: '2026-07-05' })],
    })
    expect(pickOneThing([stalled])).toBeNull()

    const withRescueTask = makeGoal({
      rescue_mode: true,
      daily_tasks: [makeTask({ assigned_date: TODAY, is_rescue_task: true })],
    })
    expect(pickOneThing([withRescueTask])).not.toBeNull()
  })

  it('breaks ties within a goal by lower position', () => {
    const second = makeTask({ assigned_date: TODAY, position: 1 })
    const first = makeTask({ assigned_date: TODAY, position: 0 })
    const goal = makeGoal({ daily_tasks: [second, first] })
    expect(pickOneThing([goal])?.task.id).toBe(first.id)
  })
})
