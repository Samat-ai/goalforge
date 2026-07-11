// Minimal object factories for lib/ unit tests. Every field a builder fills is
// a real required field from lib/types.ts — override only what the test cares about.
import type { Goal, Milestone, Task } from '../types'

let seq = 0
const nextId = (prefix: string) => `${prefix}_${++seq}`

export function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: nextId('task'),
    goal_id: 'goal_1',
    milestone_id: 'ms_1',
    description: 'Do the thing',
    tip: 'You got this',
    assigned_date: '2026-07-10',
    position: 0,
    is_completed: false,
    completed_at: null,
    is_rescue_task: false,
    is_user_added: false,
    original_description: null,
    original_tip: null,
    ...over,
  }
}

export function makeMilestone(over: Partial<Milestone> = {}): Milestone {
  return {
    id: 'ms_1',
    goal_id: 'goal_1',
    title: 'Sprint 1',
    position: 1,
    is_final: false,
    sprint_theme: 'Foundations',
    sprint_status: 'active',
    is_completed: false,
    completed_at: null,
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  }
}

export function makeGoal(over: Partial<Goal> = {}): Goal {
  const milestones = over.milestones ?? [makeMilestone()]
  return {
    id: nextId('goal'),
    user_id: 'user_1',
    raw_input: 'run a 5k',
    smart_title: 'Run a 5K',
    smart_description: 'Train to run 5 km',
    goal_type: 'health',
    target_date: '2026-09-01',
    milestones,
    milestones_completed: milestones.filter(m => m.is_completed).length,
    milestones_total: milestones.length,
    status: 'active',
    progress: 0,
    created_at: '2026-07-01T00:00:00Z',
    daily_tasks: [],
    completed_days: [],
    rescue_mode: false,
    ...over,
  }
}
