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
export const todayStr = () => new Date().toISOString().split("T")[0]

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
      cur = new Date(new Date(cur).getTime() - 864e5).toISOString().split("T")[0]
    } else {
      break
    }
  }
  return s
}

// ── Star brightness (0–1) — earned over 7 consecutive days ───────────────────
// Day 1 completion = dim ember (~14%). Day 7 streak = blazing (100%).
// Breaking the streak resets brightness. Aligns with the 7-day AI task plan.
export function starBrightness(days: string[]): number {
  return Math.min(1, streak(days) / 7)
}
