// ── Evolution stages ──────────────────────────────────────────────────────────
export const STAGES = [
  { id: 0, name: "Speck",     pts: 0,   color: "#4a4a6a", desc: "A tiny spark of intention." },
  { id: 1, name: "Ember",     pts: 30,  color: "#c2410c", desc: "Warming up. Something stirs." },
  { id: 2, name: "Flare",     pts: 80,  color: "#f97316", desc: "Bright and growing. Momentum is building." },
  { id: 3, name: "Luminary",  pts: 175, color: "#fbbf24", desc: "Radiating light. Your consistency is showing." },
  { id: 4, name: "Nova",      pts: 350, color: "#bae6fd", desc: "A brilliant burst. You're unstoppable." },
  { id: 5, name: "Celestial", pts: 600, color: "#a5f3fc", desc: "Transcendent. Pure stellar energy." },
]

export function getStage(p: number) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (p >= STAGES[i].pts) return STAGES[i]
  }
  return STAGES[0]
}

export function getNext(p: number) {
  return STAGES.find(s => s.pts > p) ?? null
}

export function stagePct(p: number): number {
  const c = getStage(p)
  const n = getNext(p)
  return n ? (p - c.pts) / (n.pts - c.pts) : 1
}

// ── Date helpers ──────────────────────────────────────────────────────────────
export const todayStr = () => new Intl.DateTimeFormat('en-CA').format(new Date())

// Returns the date N days before dateStr in the browser's local timezone.
// Uses noon-anchor to avoid DST midnight ambiguity.
export const daysAgo = (dateStr: string, n: number): string => {
  const d = new Date(dateStr + "T12:00:00")
  d.setDate(d.getDate() - n)
  return new Intl.DateTimeFormat('en-CA').format(d)
}

// Difference in whole calendar days between two ISO dates (YYYY-MM-DD).
// Noon-anchor avoids DST midnight edge-cases.
export const dayDiff = (fromDateStr: string, toDateStr: string): number => {
  const from = new Date(fromDateStr + 'T12:00:00').getTime()
  const to = new Date(toDateStr + 'T12:00:00').getTime()
  return Math.max(0, Math.round((to - from) / 864e5))
}

// ── Streak (consecutive completed days ending today) ──────────────────────────
export function streak(days: string[]): number {
  const today = todayStr()
  // Filter out any future dates to prevent them from breaking the streak walk
  const past = days.filter(d => d <= today)
  if (!past.length) return 0
  let s = 0
  let cur = today
  for (const d of [...past].sort().reverse()) {
    if (d === cur) {
      s++
      cur = daysAgo(cur, 1)
    } else {
      break
    }
  }
  return s
}

// ── Last streak (length of most recently broken streak) ──────────────────────
// Returns 0 if there is an active streak or no history. Used to render a ghost
// "last streak: Xd" badge when the current streak is broken.
export function lastStreakLength(days: string[]): number {
  if (streak(days) > 0) return 0
  const today = todayStr()
  const past = days.filter(d => d < today).sort().reverse()
  if (!past.length) return 0
  let count = 0
  let cur = past[0]
  for (const d of past) {
    if (d === cur) {
      count++
      cur = daysAgo(cur, 1)
    } else {
      break
    }
  }
  return count
}

// ── Habit strength (0–1) — exponential smoothing with 30-day window ──────────
// Inspired by Loop/uhabits: strength decays gradually on misses instead of
// resetting to 0.  Update rule per day: strength = strength × 0.85 + (done ? 0.15 : 0)
// Capped to the last 30 days for O(30) performance regardless of account age.
// Steady-state at daily completion ≈ 1.0; one missed day costs ~15%.
const HABIT_WINDOW = 30
const DECAY = 0.85
const GAIN = 1 - DECAY // 0.15

export function habitStrength(days: string[]): number {
  const today = todayStr()
  const set = new Set(days.filter(d => d <= today))
  if (set.size === 0) return 0

  // Build the 30-day window oldest-first (day -29 → day 0)
  let strength = 0
  for (let i = HABIT_WINDOW - 1; i >= 0; i--) {
    const d = daysAgo(today, i)
    strength = strength * DECAY + (set.has(d) ? GAIN : 0)
  }
  return Math.min(1, Math.max(0, strength))
}

// Backwards-compatible alias used by GoalCard.
export const starBrightness = habitStrength
