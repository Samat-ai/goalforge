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
const daysAgo = (dateStr: string, n: number): string => {
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

// ── Star brightness (0–1) — rolling 7-day strength with gradual decay ────────
// Looks at a 7-day window ending today. Each day is weighted so recent days
// matter more (recency-weighted): day 0 (today) = 7, day -1 = 6, … day -6 = 1.
// Total possible weight = 28.  Missing a single day costs ~15-25% depending on
// recency, rather than resetting to 0.  Rewards sustained effort while forgiving
// the occasional off day.
export function starBrightness(days: string[]): number {
  const today = todayStr()
  const set = new Set(days.filter(d => d <= today))
  if (set.size === 0) return 0

  let score = 0
  const totalWeight = 28 // 7+6+5+4+3+2+1
  for (let i = 0; i < 7; i++) {
    const d = daysAgo(today, i)
    if (set.has(d)) score += 7 - i // today = 7, yesterday = 6, … 6 days ago = 1
  }
  return Math.min(1, score / totalWeight)
}
