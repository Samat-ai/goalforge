import { useEffect, useState } from 'react'

const fmtLocal = (d: Date) => new Intl.DateTimeFormat('en-CA').format(d)

type Streak = { start: number; len: number }
type Computed = { streaks: Streak[]; longest: number; current: number; total: number }

// 8-week streak timeline. Date math runs in an effect (ESLint bans new Date() in render).
export default function StreakBars({ days }: { days: string[] }) {
  const [c, setC] = useState<Computed>({ streaks: [], longest: 1, current: 0, total: 0 })

  useEffect(() => {
    const set = new Set(days)
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const arr: boolean[] = []
    for (let i = 55; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); arr.push(set.has(fmtLocal(d))) }
    const sk: Streak[] = []
    let i = 0
    while (i < arr.length) {
      if (arr[i]) { const s = i; while (i < arr.length && arr[i]) i++; sk.push({ start: s, len: i - s }) }
      else i++
    }
    const longest = Math.max(...sk.map(s => s.len), 1)
    let current = 0
    if (arr[arr.length - 1]) { let j = arr.length - 1; while (j >= 0 && arr[j]) { current++; j-- } }
    setC({ streaks: sk, longest, current, total: arr.filter(Boolean).length })
  }, [days])

  return (
    <div>
      <div className="gf-sb-stats">
        {([['Current', c.current], ['Longest', c.longest], ['Total', c.total]] as const).map(([l, v]) => (
          <div key={l}><div className="gf-sb-lbl">{l}</div><div className="gf-sb-val">{v}<span>days</span></div></div>
        ))}
      </div>
      <div className="gf-sb-track">
        <div className="gf-sb-baseline" />
        {c.streaks.map((s, idx) => {
          const left = (s.start / 56) * 100
          const width = Math.max((s.len / 56) * 100, 0.6)
          const isCur = idx === c.streaks.length - 1 && c.current > 0
          const h = 4 + Math.round((s.len / c.longest) * 18)
          return (
            <div
              key={idx}
              className={['gf-sb-bar', isCur && 'is-cur', s.len === c.longest && 'is-long'].filter(Boolean).join(' ')}
              title={`${s.len}-day streak${isCur ? ' · current' : s.len === c.longest ? ' · longest' : ''}`}
              style={{ left: `${left}%`, width: `${width}%`, height: h, top: `${20 - h / 2}px` }}
            />
          )
        })}
      </div>
    </div>
  )
}
