import { todayStr } from './gamification'
import type { Goal, Milestone, Task } from './types'

export interface FocusItem {
  task: Task
  goal: Goal
  milestone: Milestone
}

const RESCUE_SCORE = 10_000
const TODAY_SCORE = 1_000
const OVERDUE_BASE = 100

function getActiveMilestone(goal: Goal): Milestone | undefined {
  return goal.milestones.find(m => m.sprint_status === 'active' && !m.is_completed)
}

/** Returns days between two YYYY-MM-DD strings (toDate - fromDate). Uses noon anchor to avoid DST issues. */
function dateDiffDays(fromDate: string, toDate: string): number {
  const from = new Date(fromDate + 'T12:00:00').getTime()
  const to = new Date(toDate + 'T12:00:00').getTime()
  return Math.round((to - from) / 86_400_000)
}

/**
 * Picks the single highest-priority incomplete task across all active goals.
 * Returns null if there is nothing actionable.
 *
 * Priority: rescue-task-today > today > overdue (weighted by days late) > future
 * Tiebreaker: lower goal.progress wins; within same goal, lower task.position wins.
 */
export function pickOneThing(goals: Goal[]): FocusItem | null {
  const today = todayStr()

  let bestItem: FocusItem | null = null
  let bestScore = -1

  for (const goal of goals) {
    if (goal.status !== 'active') continue

    const activeMilestone = getActiveMilestone(goal)
    if (!activeMilestone) continue

    // Skip goals in rescue mode that have not yet had rescue tasks generated for today.
    // The GoalCard rescue card handles those goals — don't interfere.
    if (goal.rescue_mode) {
      const hasRescueTaskToday = goal.daily_tasks.some(
        t => t.is_rescue_task && t.assigned_date === today && !t.is_completed,
      )
      if (!hasRescueTaskToday) continue
    }

    for (const task of goal.daily_tasks) {
      if (task.is_completed) continue

      let score: number

      if (task.is_rescue_task && task.assigned_date === today) {
        score = RESCUE_SCORE
      } else if (task.assigned_date === today) {
        score = TODAY_SCORE
      } else if (task.assigned_date < today) {
        const daysOverdue = dateDiffDays(task.assigned_date, today)
        score = Math.min(OVERDUE_BASE + daysOverdue, TODAY_SCORE - 1)
      } else {
        continue // future task — not actionable today, skip
      }

      const isBetter =
        bestItem === null ||
        score > bestScore ||
        (score === bestScore && goal.progress < bestItem.goal.progress) ||
        (score === bestScore &&
          goal.progress === bestItem.goal.progress &&
          task.position < bestItem.task.position)

      if (isBetter) {
        bestItem = { task, goal, milestone: activeMilestone }
        bestScore = score
      }
    }
  }

  return bestItem
}
