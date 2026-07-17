// goalView.ts — adapter: API `Goal` -> prototype view-prop shape.
// Reproduces the per-goal object shape from design_handoff_goalforge/app/gf-data.jsx:39-112
// so gf/GoalCard.tsx (transcribed from gf-goalcard.jsx) can render real data unmodified.
import { streak as calcStreak, starBrightness, lastStreakLength, todayStr, dayDiff } from './gamification'
import type { Goal, Milestone } from './types'

// ── Star lifecycle thresholds ────────────────────────────────────────────────
// Below DYING_BRIGHTNESS the star is visibly going out; the idle-days floor
// protects brand-new goals (zero completions = brightness 0 from day one).
// FADED_IDLE_DAYS mirrors the backend's AUTO_ABANDON_DAYS (services/goal_service.py)
// so the abandoned banner can tell "faded away" apart from a manual abandon.
const DYING_BRIGHTNESS = 0.05
const DYING_IDLE_DAYS = 7
const FADED_IDLE_DAYS = 30

/** Days since the goal last saw activity: latest completed day (≤ today),
 * else the goal's creation date. created_at is sliced as a UTC date — up to
 * one day of skew vs the user's local today, immaterial at 7/30-day scales. */
export function daysSinceLastActivity(goal: Goal): number {
  const today = todayStr()
  const past = goal.completed_days.filter(d => d <= today)
  const last = past.length > 0 ? past[past.length - 1] : goal.created_at.slice(0, 10)
  return Math.max(0, dayDiff(last, today))
}

/** An active goal whose star has burned down to a flicker. */
export function goalIsDying(goal: Goal): boolean {
  return (
    goal.status === 'active' &&
    starBrightness(goal.completed_days) < DYING_BRIGHTNESS &&
    daysSinceLastActivity(goal) >= DYING_IDLE_DAYS
  )
}

export interface GoalViewTask {
  id: string
  title: string
  done: boolean
  resized: boolean
  position: number
  isUserAdded: boolean
}

export interface GoalViewMilestone {
  pos: number
  title: string
  status: 'completed' | 'active' | 'upcoming' | 'failed'
}

export interface GoalView {
  id: string
  smart_title: string
  goal_type: string
  smart_description: string
  raw_input: string
  status: Goal['status']
  progress: number
  streak: number
  lastStreak: number
  brightness: number
  isDying: boolean
  isFaded: boolean
  deadline: string
  deadlineKind: 'ok' | 'soon' | 'over'
  tasks: GoalViewTask[]
  overdue: GoalViewTask[]
  milestones: GoalViewMilestone[]
  completed_days: string[]
}

const SOON_DAYS = 14

function milestoneStatus(m: Milestone): GoalViewMilestone['status'] {
  if (m.is_completed) return 'completed'
  if (m.sprint_status === 'failed') return 'failed'
  if (m.sprint_status === 'active' || m.sprint_status === 'generating') return 'active'
  return 'upcoming'
}

function toTask(t: Goal['daily_tasks'][number]): GoalViewTask {
  return {
    id: t.id,
    title: t.description,
    done: t.is_completed,
    resized: t.original_description != null,
    position: t.position,
    isUserAdded: t.is_user_added ?? false,
  }
}

export function toGoalView(goal: Goal): GoalView {
  const today = todayStr()
  const tasks = goal.daily_tasks
    .filter(t => t.assigned_date === today)
    .sort((a, b) => a.position - b.position)
    .map(toTask)
  const overdue = goal.daily_tasks
    .filter(t => !t.is_completed && t.assigned_date < today)
    .sort((a, b) => a.assigned_date.localeCompare(b.assigned_date) || a.position - b.position)
    .map(toTask)

  let deadline: string
  let deadlineKind: GoalView['deadlineKind']
  if (goal.status === 'achieved') {
    deadline = 'done'
    deadlineKind = 'ok'
  } else {
    const days = Math.round(
      (new Date(`${goal.target_date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000,
    )
    if (days < 0) { deadline = 'overdue'; deadlineKind = 'over' }
    else if (days === 0) { deadline = 'today'; deadlineKind = 'soon' }
    else if (days === 1) { deadline = 'tomorrow'; deadlineKind = 'soon' }
    else { deadline = `${days}d left`; deadlineKind = days <= SOON_DAYS ? 'soon' : 'ok' }
  }

  return {
    id: goal.id,
    smart_title: goal.smart_title,
    goal_type: goal.goal_type,
    smart_description: goal.smart_description,
    raw_input: goal.raw_input,
    status: goal.status,
    progress: goal.milestones_total > 0
      ? Math.round((goal.milestones_completed / goal.milestones_total) * 100)
      : goal.progress,
    streak: calcStreak(goal.completed_days),
    lastStreak: lastStreakLength(goal.completed_days),
    brightness: goal.status === 'achieved' ? 1 : starBrightness(goal.completed_days),
    isDying: goalIsDying(goal),
    isFaded: goal.status === 'abandoned' && daysSinceLastActivity(goal) >= FADED_IDLE_DAYS,
    deadline,
    deadlineKind,
    tasks,
    overdue,
    milestones: [...goal.milestones]
      .sort((a, b) => a.position - b.position)
      .map(m => ({ pos: m.position, title: m.title, status: milestoneStatus(m) })),
    completed_days: goal.completed_days,
  }
}
