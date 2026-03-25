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

// ── Habit strength (0–1) — resilient decay model ─────────────────────────────
// Inspired by Loop/uhabits behavior: progress decays gradually on misses.
// Update rule per day: strength = strength * 0.85 + (completed ? 0.15 : 0)
// This keeps momentum valuable while avoiding binary streak reset punishment.
export function habitStrength(days: string[]): number {
  const today = todayStr()
  const past = [...new Set(days.filter(d => d <= today))].sort()
  if (past.length === 0) return 0

  let strength = 0
  const completed = new Set(past)
  let cursor = past[0]

  while (cursor <= today) {
    const done = completed.has(cursor)
    strength = strength * 0.85 + (done ? 0.15 : 0)
    cursor = daysAgo(cursor, -1)
  }

  return Math.min(1, Math.max(0, strength))
}

// Backwards-compatible alias used by existing UI components.
export const starBrightness = habitStrength
