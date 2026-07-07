// analyticsView.ts — pure builders that derive the Analytics page's data shapes
// (design_handoff_goalforge/app/gf-data.jsx:134-174) from real API data.
// No `new Date()` in component render bodies — all date math routes through the
// DST-safe helpers in gamification.ts, anchored on a `today` ISO string.
import { daysAgo, streak, bestStreak, todayStr } from './gamification'
import type { Goal, Task } from './types'

export interface VelocityDay {
  label: string
  count: number
  date: string
}

export interface HeatmapCell {
  date: string
  count: number
  dow: number
}

export interface MonthLabel {
  col: number
  label: string
}

export interface HeatmapResult {
  weeks: HeatmapCell[][]
  monthLabels: MonthLabel[]
}

export interface TimeOfDaySlice {
  name: string
  value: number
}

export interface AnalyticsStats {
  activeGoals: number
  tasksCompleted: number
  starPoints: number
  currentStreak: number
  personalBest: number
  thisWeek: number
  lastWeek: number
  consistency: number
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const HEATMAP_WEEKS = 18

function fmt(d: Date): string {
  return new Intl.DateTimeFormat('en-CA').format(d)
}

function allCompletedTasks(goals: Goal[]): Task[] {
  return goals.flatMap(g => g.daily_tasks).filter(t => t.is_completed && !!t.completed_at)
}

function tasksByDateMap(tasks: Task[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of tasks) {
    const d = fmt(new Date(t.completed_at as string))
    map.set(d, (map.get(d) ?? 0) + 1)
  }
  return map
}

// ── 7-day velocity (gf-data.jsx:136-141) ────────────────────────────────────
export function buildVelocity(goals: Goal[], today: string = todayStr()): VelocityDay[] {
  const byDate = tasksByDateMap(allCompletedTasks(goals))
  const velocity: VelocityDay[] = []
  for (let i = 6; i >= 0; i--) {
    const date = daysAgo(today, i)
    const dow = new Date(date + 'T12:00:00').getDay()
    velocity.push({ label: DAY_NAMES[dow], count: byDate.get(date) ?? 0, date })
  }
  return velocity
}

// ── 18-week completion heatmap, Sun-first columns (gf-data.jsx:143-164) ─────
export function buildHeatmap(goals: Goal[], today: string = todayStr()): HeatmapResult {
  const byDate = tasksByDateMap(allCompletedTasks(goals))
  const todayDow = new Date(today + 'T12:00:00').getDay()
  // Sunday that starts the first (oldest) of the 18 weeks.
  const startSunday = daysAgo(today, (HEATMAP_WEEKS * 7 - 1) - (6 - todayDow))

  const weeks: HeatmapCell[][] = []
  const monthLabels: MonthLabel[] = []
  const cursor = new Date(startSunday + 'T12:00:00')
  let prevMonth = -1
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week: HeatmapCell[] = []
    for (let dow = 0; dow < 7; dow++) {
      const date = fmt(cursor)
      const future = date > today
      const count = future ? -1 : (byDate.get(date) ?? 0)
      week.push({ date, count, dow })
      if (dow === 0 && cursor.getMonth() !== prevMonth) {
        monthLabels.push({ col: w, label: MONTH_NAMES[cursor.getMonth()] })
        prevMonth = cursor.getMonth()
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return { weeks, monthLabels }
}

// ── N-day sparkline: completed-task counts per day, oldest → today ──────────
export function buildSpark(goals: Goal[], days = 10, today: string = todayStr()): number[] {
  const byDate = tasksByDateMap(allCompletedTasks(goals))
  const spark: number[] = []
  for (let i = days - 1; i >= 0; i--) spark.push(byDate.get(daysAgo(today, i)) ?? 0)
  return spark
}

// ── Time-of-day distribution, derived from Task.completed_at hour ───────────
export function buildTimeOfDay(goals: Goal[]): TimeOfDaySlice[] {
  const slots = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 }
  for (const t of allCompletedTasks(goals)) {
    const hour = new Date(t.completed_at as string).getHours()
    if (hour >= 5 && hour < 12) slots.Morning++
    else if (hour >= 12 && hour < 17) slots.Afternoon++
    else if (hour >= 17 && hour < 24) slots.Evening++
    else slots.Night++
  }
  return Object.entries(slots).map(([name, value]) => ({ name, value }))
}

// ── Top-line stat tiles + activity-ring inputs (gf-data.jsx:171-174) ────────
export function buildStats(goals: Goal[], profile: { pts: number }, today: string = todayStr()): AnalyticsStats {
  const activeGoals = goals.filter(g => g.status === 'active').length
  const completedTasks = allCompletedTasks(goals)
  const byDate = tasksByDateMap(completedTasks)
  const allCompletedDays = [...new Set(goals.flatMap(g => g.completed_days))].sort()

  const thisWeekStart = daysAgo(today, 6)
  const lastWeekStart = daysAgo(today, 13)
  let thisWeek = 0
  let lastWeek = 0
  for (const [date, count] of byDate) {
    if (date >= thisWeekStart && date <= today) thisWeek += count
    else if (date >= lastWeekStart && date < thisWeekStart) lastWeek += count
  }

  const thirtyDaysAgo = daysAgo(today, 29)
  const activeDaysIn30 = allCompletedDays.filter(d => d >= thirtyDaysAgo && d <= today).length

  return {
    activeGoals,
    tasksCompleted: completedTasks.length,
    starPoints: profile.pts,
    currentStreak: streak(allCompletedDays),
    personalBest: bestStreak(allCompletedDays),
    thisWeek,
    lastWeek,
    consistency: activeDaysIn30 / 30,
  }
}
