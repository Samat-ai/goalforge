// goalView.ts — adapter: API `Goal` -> prototype view-prop shape.
// Reproduces the per-goal object shape from design_handoff_goalforge/app/gf-data.jsx:39-112
// so gf/GoalCard.tsx (transcribed from gf-goalcard.jsx) can render real data unmodified.
import { streak as calcStreak, starBrightness, lastStreakLength, todayStr } from './gamification'
import type { Goal, Milestone } from './types'

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
