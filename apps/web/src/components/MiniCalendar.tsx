import { useEffect, useMemo, useState } from 'react'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtLocal = (d: Date) => new Intl.DateTimeFormat('en-CA').format(d)

function pretty(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DOW[dt.getDay()]}, ${MON[m - 1]} ${d}`
}

type Cell = { iso: string; state: 'done' | 'miss' | 'future' }

// 8-week completion grid. Date math runs in an effect (ESLint bans new Date() in render).
export default function MiniCalendar({ days }: { days: string[] }) {
  const set = useMemo(() => new Set(days), [days])
  const [weeks, setWeeks] = useState<Cell[][]>([])

  useEffect(() => {
    const total = 56
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const start = new Date(today); start.setDate(start.getDate() - (total - 1))
    const dow = (start.getDay() + 6) % 7 // 0 = Monday
    start.setDate(start.getDate() - dow)
    const cells: Cell[] = []
    for (let i = 0; i < total; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i)
      const iso = fmtLocal(d)
      cells.push({ iso, state: d > today ? 'future' : set.has(iso) ? 'done' : 'miss' })
    }
    const w: Cell[][] = []
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7))
    setWeeks(w)
  }, [set])

  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div className="gf-cal">
      <div className="gf-cal-labels">{labels.map((l, i) => <span key={i} className="gf-cal-lbl">{l}</span>)}</div>
      <div className="gf-cal-weeks">
        {weeks.map((wk, wi) => (
          <div key={wi} className="gf-cal-col">
            {wk.map((c, di) => (
              <span
                key={di}
                className={['gf-cal-cell', c.state === 'done' && 'is-done', c.state === 'future' && 'is-future'].filter(Boolean).join(' ')}
                title={c.state === 'future' ? undefined : `${c.state === 'done' ? 'Completed' : 'No activity'} · ${pretty(c.iso)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
