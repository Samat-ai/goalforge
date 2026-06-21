import { useState, useEffect, useRef, useMemo } from 'react'
import { useUser } from '@clerk/react'
import { getStage, streak, bestStreak, todayStr, daysAgo } from '../lib/gamification'
import {
  useAllGoalsQuery,
  useBadgesQuery,
  useCreateWeeklyReflectionMutation,
  useLatestWeeklyReflectionQuery,
  useProfileQuery,
} from '../hooks'
import Icon from '../components/ui/Icon'

// ── Count-up hook (IntersectionObserver, fires once, reduced-motion safe) ──────
function useCountUp(target: number, { duration = 1400 }: { duration?: number } = {}) {
  const [val, setVal] = useState(0)
  const ref = useRef<number>(0)
  const started = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setVal(target); return }
    if (started.current) return
    const node = containerRef.current
    if (!node) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return
        started.current = true
        obs.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
          setVal(Math.round(eased * target))
          if (t < 1) ref.current = requestAnimationFrame(tick)
        }
        ref.current = requestAnimationFrame(tick)
      },
      { threshold: 0.1 }
    )
    obs.observe(node)
    return () => {
      obs.disconnect()
      cancelAnimationFrame(ref.current)
    }
  }, [target, duration])

  return { val, containerRef }
}

// ── SVG Ring (nested activity rings) ─────────────────────────────────────────
function Ring({ value, size, stroke, color }: { value: number; size: number; stroke: number; color: string }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setDrawn(true), 120)
    return () => clearTimeout(id)
  }, [])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const displayValue = drawn ? value : value * 0.8
  const filled = c * Math.min(1, Math.max(0, displayValue))
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.22,.61,.36,1)' }}
      />
    </svg>
  )
}

// ── Sparkline (inline SVG, normalized path + gradient fill) ─────────────────
function Sparkline({ data, color = 'var(--accent)', w = 110, h = 30 }: {
  data: number[]
  color?: string
  w?: number
  h?: number
}) {
  const id = useMemo(() => 'sp' + Math.random().toString(36).slice(2, 7), [])
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - 4 - ((v - min) / (max - min || 1)) * (h - 8)
    return [x, y] as [number, number]
  })
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  )
}

// ── Stat tile with count-up ───────────────────────────────────────────────────
function StatTile({
  label, value, suffix, accent, spark, trend, progress, progFill,
}: {
  label: string
  value: number
  suffix?: string
  accent: string
  spark?: number[]
  trend?: { dir: 'up' | 'down'; text: string } | null
  progress?: { value: number; label: string } | null
  progFill?: string
}) {
  const { val, containerRef } = useCountUp(value)
  return (
    <div className="gf-stat" ref={containerRef}>
      <div className="gf-stat-label">{label}</div>
      <div className="gf-stat-val" style={{ color: accent }}>
        {val}{suffix && <span className="gf-stat-suf">{suffix}</span>}
      </div>
      {spark && spark.length >= 2 && (
        <div className="gf-stat-spark">
          <Sparkline data={spark} color={accent} w={110} h={30} />
        </div>
      )}
      {trend && (
        <div className={`gf-stat-trend ${trend.dir}`}>
          <Icon name={trend.dir === 'up' ? 'arrowUp' : 'arrowDown'} size={12} /> {trend.text}
        </div>
      )}
      {progress && (
        <div className="gf-stat-prog">
          <div className="gf-stat-prog-track">
            <div
              className="gf-stat-prog-fill"
              style={{ width: `${Math.round(Math.min(1, progress.value) * 100)}%`, background: progFill || accent }}
            />
          </div>
          <div className="gf-stat-prog-cap">{progress.label}</div>
        </div>
      )}
    </div>
  )
}

// ── Velocity bars (animated, motion-gated) ───────────────────────────────────
function VelocityBars({ velocityDays }: { velocityDays: { label: string; count: number }[] }) {
  const [grow, setGrow] = useState(false)
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setGrow(true); return }
    const id = setTimeout(() => setGrow(true), 240)
    return () => clearTimeout(id)
  }, [])
  const max = Math.max(...velocityDays.map(d => d.count), 1)
  return (
    <div className="gf-bars">
      {velocityDays.map((d, i) => {
        const isToday = i === velocityDays.length - 1
        const heightPct = (d.count / max) * 100 * (grow ? 1 : 0.72)
        return (
          <div key={i} className="gf-bar-col">
            <div className="gf-bar-track">
              <div
                className="gf-bar-grow"
                style={{ height: `${heightPct}%`, transitionDelay: `${i * 55}ms` }}
              >
                <span className="gf-bar-val">{d.count}</span>
              </div>
            </div>
            <span className={['gf-bar-lbl', isToday && 'is-today'].filter(Boolean).join(' ')}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── SVG Donut (time-of-day) ───────────────────────────────────────────────────
const DONUT_COLORS = ['var(--accent)', 'var(--ring-2)', 'var(--ring-3)', 'var(--text-mute)']

function TimeDonut({ timeOfDay }: { timeOfDay: { name: string; value: number }[] }) {
  const [draw, setDraw] = useState(false)
  const [active, setActive] = useState(-1)
  useEffect(() => {
    const id = setTimeout(() => setDraw(true), 260)
    return () => clearTimeout(id)
  }, [])

  const total = timeOfDay.reduce((s, d) => s + d.value, 0)
  const r = 52
  const c = 2 * Math.PI * r
  let acc = 0

  return (
    <div className="gf-donut-wrap">
      <svg
        className={['gf-donut-svg', active >= 0 && 'is-dim'].filter(Boolean).join(' ')}
        width="132" height="132" viewBox="0 0 132 132"
        style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
      >
        {timeOfDay.map((d, i) => {
          const frac = d.value / total
          const ratio = draw ? 1 : 0.82
          const len = c * frac * ratio
          const seg = (
            <circle
              key={i}
              className={['gf-donut-seg', active === i && 'is-on'].filter(Boolean).join(' ')}
              cx="66" cy="66" r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={active === i ? 17 : 14}
              strokeDasharray={`${len} ${c}`}
              strokeDashoffset={-acc}
              strokeLinecap="butt"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(-1)}
              style={{
                transition: `stroke-dasharray .8s cubic-bezier(.22,.61,.36,1) ${i * 70}ms, stroke-width .18s ease, opacity .18s ease`,
              }}
            />
          )
          acc += c * frac
          return seg
        })}
      </svg>
      <div className="gf-donut-legend">
        {timeOfDay.map((d, i) => (
          <div
            key={d.name}
            className={['gf-legrow gf-legrow-int', active === i && 'is-active'].filter(Boolean).join(' ')}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(-1)}
          >
            <span className="gf-legdot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <div className="gf-leg-label" style={{ fontSize: 13 }}>{d.name}</div>
            <div className="gf-leg-pct">
              {Math.round((d.value / total) * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Heatmap (5-level GitHub-style grid) ───────────────────────────────────────
const HEAT_LEVELS = [
  'var(--ring-track)',
  'color-mix(in oklab, var(--accent) 26%, transparent)',
  'color-mix(in oklab, var(--accent) 48%, transparent)',
  'color-mix(in oklab, var(--accent) 72%, transparent)',
  'var(--accent)',
]
function heatLevel(n: number) { return n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4 }

function Heatmap({ heatmapWeeks, heatmapMonthLabels }: {
  heatmapWeeks: { date: string; count: number; dow: number }[][]
  heatmapMonthLabels: { col: number; label: string }[]
}) {
  return (
    <div className="gf-card gf-heat">
      <div className="gf-card-cap">
        Completion heatmap{' '}
        <span style={{ color: 'var(--text-mute)', textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
          last 13 weeks
        </span>
      </div>
      <div className="hm-months">
        {heatmapMonthLabels.map((m, i) => {
          const prev = heatmapMonthLabels[i - 1]
          const marginLeft = i === 0 ? 0 : (m.col - (prev?.col ?? 0)) * 17 - 17
          return (
            <span key={m.label + i} style={{ marginLeft: i === 0 ? 0 : marginLeft }}>
              {m.label}
            </span>
          )
        })}
      </div>
      <div className="hm-wrap">
        <div className="hm-days">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
            <span key={d}>{i % 2 === 0 ? d : ''}</span>
          ))}
        </div>
        <div className="hm-grid">
          {heatmapWeeks.flatMap((week, wi) =>
            week.map((d, di) => {
              const isFuture = d.count < 0
              return (
                <span
                  key={`${wi}-${di}`}
                  className={['hm-cell', isFuture && 'is-empty'].filter(Boolean).join(' ')}
                  style={{ background: isFuture ? 'transparent' : HEAT_LEVELS[heatLevel(d.count)] }}
                  title={isFuture ? undefined : `${d.count} task${d.count !== 1 ? 's' : ''} · ${d.date}`}
                />
              )
            })
          )}
        </div>
      </div>
      <div className="hm-legend">
        <span>Less</span>
        {HEAT_LEVELS.map((bg, i) => (
          <span key={i} className="hm-cell" style={{ background: bg }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

// ── Analytics page ────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user } = useUser()
  const userId = user?.id

  const { goals, isLoading: loading, isError, refetch } = useAllGoalsQuery(userId)
  const { pts } = useProfileQuery(userId)
  const { badges } = useBadgesQuery(userId)
  const { reflection } = useLatestWeeklyReflectionQuery(userId)
  const { createReflection, isSaving } = useCreateWeeklyReflectionMutation(userId ?? '')
  const [wentWell, setWentWell] = useState('')
  const [blockers, setBlockers] = useState('')
  const [weekRating, setWeekRating] = useState(3)

  useEffect(() => { document.title = 'Analytics — GoalForge' }, [])

  const analytics = useMemo(() => {
    if (!goals.length) return null
    const today = todayStr()
    const active = goals.filter(g => g.status === 'active')
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA').format(d)

    const allCompletedDays = [...new Set(goals.flatMap(g => g.completed_days))].sort()
    const allTasks = goals.flatMap(g => g.daily_tasks)
    const completedTasks = allTasks.filter(t => t.is_completed)

    const currentStreak = streak(allCompletedDays)
    const personalBest = bestStreak(allCompletedDays)

    const thisWeekStart = daysAgo(today, 6)
    const lastWeekStart = daysAgo(today, 13)
    const thisWeekCount = completedTasks.filter(t => {
      if (!t.completed_at) return false
      const d = fmt(new Date(t.completed_at))
      return d >= thisWeekStart && d <= today
    }).length
    const lastWeekCount = completedTasks.filter(t => {
      if (!t.completed_at) return false
      const d = fmt(new Date(t.completed_at))
      return d >= lastWeekStart && d < thisWeekStart
    }).length

    const tasksByDate = new Map<string, number>()
    for (const t of completedTasks) {
      if (!t.completed_at) continue
      const d = fmt(new Date(t.completed_at))
      tasksByDate.set(d, (tasksByDate.get(d) ?? 0) + 1)
    }

    // Heatmap: 13 weeks Sun-Sat
    const todayDate = new Date(today + 'T12:00:00')
    const todayDow = todayDate.getDay()
    const endOfWeekSat = new Date(todayDate)
    endOfWeekSat.setDate(todayDate.getDate() + (6 - todayDow))
    const startSunday = new Date(endOfWeekSat)
    startSunday.setDate(endOfWeekSat.getDate() - (13 * 7 - 1))
    const heatmapWeeks: { date: string; count: number; dow: number }[][] = []
    const heatmapMonthLabels: { col: number; label: string }[] = []
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let prevMonth = -1
    const cursor = new Date(startSunday)
    for (let week = 0; week < 13; week++) {
      const weekDays: { date: string; count: number; dow: number }[] = []
      for (let dow = 0; dow < 7; dow++) {
        const d = fmt(cursor)
        const isFuture = d > today
        weekDays.push({ date: d, count: isFuture ? -1 : (tasksByDate.get(d) ?? 0), dow })
        if (dow === 0 && cursor.getMonth() !== prevMonth) {
          heatmapMonthLabels.push({ col: week, label: monthNames[cursor.getMonth()] })
          prevMonth = cursor.getMonth()
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      heatmapWeeks.push(weekDays)
    }

    // 7-day velocity
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const velocityDays: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(today, i)
      velocityDays.push({ label: dayNames[new Date(d + 'T12:00:00').getDay()], count: tasksByDate.get(d) ?? 0 })
    }

    // Time-of-day
    const timeSlots = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 }
    for (const t of completedTasks) {
      if (!t.completed_at) continue
      const hour = new Date(t.completed_at).getHours()
      if (hour >= 5 && hour < 12) timeSlots.Morning++
      else if (hour >= 12 && hour < 17) timeSlots.Afternoon++
      else if (hour >= 17 && hour < 24) timeSlots.Evening++
      else timeSlots.Night++
    }
    const timeOfDay = Object.entries(timeSlots).map(([name, value]) => ({ name, value })).filter(d => d.value > 0)

    // Activity rings data
    const todayTasks = active.flatMap(g => g.daily_tasks.filter(t => t.assigned_date === today))
    const todayDone = todayTasks.filter(t => t.is_completed).length
    const todayRatio = todayTasks.length ? todayDone / todayTasks.length : 0
    const thisWeekDays = allCompletedDays.filter(d => d >= thisWeekStart && d <= today).length
    const thirtyDaysAgo = daysAgo(today, 29)
    const activeDaysIn30 = allCompletedDays.filter(d => d >= thirtyDaysAgo && d <= today).length
    const consistency30 = activeDaysIn30 / 30

    // 10-day sparkline for "Current streak" tile: daily completed task counts
    const streakSpark: number[] = []
    for (let i = 9; i >= 0; i--) {
      const d = daysAgo(today, i)
      streakSpark.push(tasksByDate.get(d) ?? 0)
    }

    return {
      allCompletedDays, currentStreak, personalBest,
      thisWeekCount, lastWeekCount, completedTasksTotal: completedTasks.length,
      heatmapWeeks, heatmapMonthLabels, velocityDays, timeOfDay,
      todayRatio, todayDone, todayTotal: todayTasks.length,
      thisWeekDays, consistency30,
      streakSpark,
    }
  }, [goals])

  const stage = getStage(pts)
  const achieved = goals.filter(g => g.status === 'achieved')

  const trendInfo = (() => {
    if (!analytics) return null
    const { thisWeekCount, lastWeekCount } = analytics
    if (lastWeekCount === 0 && thisWeekCount === 0) return null
    if (lastWeekCount === 0) return { dir: 'up' as const, text: `First week tracked — ${thisWeekCount} tasks done` }
    const diff = thisWeekCount - lastWeekCount
    const pct = Math.round(Math.abs(diff / lastWeekCount) * 100)
    if (diff > 0) return { dir: 'up' as const, text: `+${pct}% vs last week` }
    if (diff < 0) return { dir: 'down' as const, text: `-${pct}% vs last week` }
    return null
  })()

  return (
    <div className="min-h-dvh mesh-bg" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>

      <main id="main-content" className="gf-main">

        {/* Error */}
        {isError && (
          <div
            className="gf-nudge"
            style={{
              '--accent': 'var(--rose)',
              '--accent-soft': 'color-mix(in oklab, var(--rose) 10%, transparent)',
              '--accent-line': 'color-mix(in oklab, var(--rose) 32%, transparent)',
              '--accent-ink': 'var(--rose)',
              marginBottom: 20,
            } as React.CSSProperties}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gf-nudge-kicker">Load error</div>
              <div className="gf-nudge-title">Failed to load analytics data.</div>
            </div>
            <button onClick={() => refetch()} className="gf-btn-ghost-accent">Try again</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div role="status" aria-label="Loading analytics" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid var(--ring-track)', borderTop: '2px solid var(--accent)',
              animation: 'spin 0.75s linear infinite',
            }} />
          </div>
        )}

        {!loading && analytics && (
          <div className="gf-page">
            <div>
              <div className="gf-eyebrow">Your patterns</div>
            </div>

            {/* ── Stat tiles ── */}
            <div className="gf-statgrid">
              <StatTile
                label="Current streak"
                value={analytics.currentStreak}
                suffix="d"
                accent="var(--accent)"
                spark={analytics.streakSpark}
                trend={trendInfo}
              />
              <StatTile
                label="Tasks completed"
                value={analytics.completedTasksTotal}
                accent="var(--ring-2)"
                trend={{ dir: 'up', text: `${analytics.thisWeekCount} this week` }}
              />
              <StatTile
                label="Star points"
                value={pts}
                accent={stage.color}
                trend={{ dir: 'up', text: stage.name }}
              />
              <StatTile
                label="Personal best"
                value={analytics.personalBest}
                suffix="d"
                accent="var(--text)"
                progFill="var(--accent)"
                progress={analytics.personalBest > 0 ? {
                  value: analytics.currentStreak / analytics.personalBest,
                  label: analytics.personalBest - analytics.currentStreak > 0
                    ? `${analytics.personalBest - analytics.currentStreak}d to a new best`
                    : 'Current best streak!',
                } : null}
              />
            </div>

            {/* ── Activity rings + Velocity ── */}
            <div className="gf-grid-2">
              {/* Activity rings */}
              <div className="gf-card">
                <div className="gf-card-cap">Activity</div>
                <div className="gf-rings-stack">
                  <div className="gf-rings-nest">
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <Ring value={analytics.todayRatio} size={150} stroke={13} color="var(--accent)" />
                    </div>
                    <div style={{ position: 'absolute', inset: 19 }}>
                      <Ring value={analytics.thisWeekDays / 7} size={112} stroke={13} color="var(--ring-2)" />
                    </div>
                    <div style={{ position: 'absolute', inset: 38 }}>
                      <Ring value={analytics.consistency30} size={74} stroke={13} color="var(--ring-3)" />
                    </div>
                  </div>
                  <div className="gf-rings-legend">
                    {[
                      { label: 'Today', sub: `${analytics.todayDone} of ${analytics.todayTotal} tasks`, value: analytics.todayRatio, color: 'var(--accent)' },
                      { label: 'This week', sub: `${analytics.thisWeekDays} of 7 days`, value: analytics.thisWeekDays / 7, color: 'var(--ring-2)' },
                      { label: 'Consistency', sub: '30-day strength', value: analytics.consistency30, color: 'var(--ring-3)' },
                    ].map(r => (
                      <div key={r.label} className="gf-legrow">
                        <span className="gf-legdot" style={{ background: r.color }} />
                        <div>
                          <div className="gf-leg-label">{r.label}</div>
                          <div className="gf-leg-sub">{r.sub}</div>
                        </div>
                        <div className="gf-leg-pct" style={{ color: r.color }}>{Math.round(r.value * 100)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 7-day velocity */}
              <div className="gf-card">
                <div className="gf-card-cap">7-day velocity</div>
                <VelocityBars velocityDays={analytics.velocityDays} />
              </div>
            </div>

            {/* ── Heatmap + Time-of-day ── */}
            <div className="gf-grid-2">
              <Heatmap heatmapWeeks={analytics.heatmapWeeks} heatmapMonthLabels={analytics.heatmapMonthLabels} />

              {/* Time of day */}
              <div className="gf-card">
                <div className="gf-card-cap">Time of day</div>
                {analytics.timeOfDay.length > 0 ? (
                  <TimeDonut timeOfDay={analytics.timeOfDay} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-mute)', fontSize: 12 }}>
                    Complete tasks to see your pattern
                  </div>
                )}
              </div>
            </div>

            {/* ── Reflection + Badges ── */}
            <div className="gf-grid-2">
              {/* Weekly reflection */}
              <div className="gf-card">
                <div className="gf-card-cap">Weekly reflection ritual</div>
                <div className="gf-refl">
                  <textarea
                    className="gf-textarea"
                    rows={2}
                    placeholder="What went well this week?"
                    value={wentWell}
                    onChange={e => setWentWell(e.target.value)}
                  />
                  <textarea
                    className="gf-textarea"
                    rows={2}
                    placeholder="What blocked you?"
                    value={blockers}
                    onChange={e => setBlockers(e.target.value)}
                  />
                  <div className="gf-refl-row">
                    <span className="gf-refl-lbl">Week rating</span>
                    <div className="gf-stars">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          className={['gf-star', n <= weekRating && 'is-on'].filter(Boolean).join(' ')}
                          onClick={() => setWeekRating(n)}
                          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                        >
                          <Icon name="spark" size={16} />
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (wentWell.trim().length < 5 || blockers.trim().length < 5) return
                        createReflection({ went_well: wentWell.trim(), blockers: blockers.trim(), week_rating: weekRating })
                        setWentWell('')
                        setBlockers('')
                      }}
                      disabled={isSaving}
                      className="gf-btn gf-btn-accent"
                      style={{ marginLeft: 'auto', opacity: isSaving ? 0.6 : 1, height: 40, fontSize: 13, padding: '0 15px' }}
                    >
                      Save
                    </button>
                  </div>
                  {reflection && (
                    <div className="gf-coach">
                      <div className="gf-coach-cap">
                        <Icon name="spark" size={11} /> AI coach recommendation
                      </div>
                      <div className="gf-coach-body">{reflection.coach_recommendation}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Badges */}
              {badges.length > 0 && (
                <div className="gf-card">
                  <div className="gf-card-cap">Achievement badges</div>
                  <div className="gf-badges">
                    {badges.map(badge => (
                      <div key={badge.key} className={['gf-badge', badge.unlocked && 'is-on'].filter(Boolean).join(' ')}>
                        <div className="gf-badge-ic">
                          <Icon name={badge.unlocked ? 'trophy' : 'target'} size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="gf-badge-title">{badge.title}</div>
                          <div className="gf-badge-desc">{badge.description}</div>
                        </div>
                        <div className="gf-badge-prog">{Math.min(badge.current, badge.target)}/{badge.target}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Hall of fame ── */}
            {achieved.length > 0 && (
              <div>
                <div className="gf-section-cap">Hall of fame · {achieved.length} achieved</div>
                <div className="gf-goallist">
                  {achieved.map(g => {
                    const s = streak(g.completed_days)
                    return (
                      <div key={g.id} className="gf-card gf-hof">
                        <div className="gf-hof-ic">
                          <Icon name="trophy" size={20} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="gf-goal-meta">
                            <span className="gf-chip gf-chip-gold">{g.goal_type}</span>
                            {s > 0 && <span className="gf-chip gf-chip-gold-soft">{s}d streak</span>}
                            <span className="gf-chip gf-chip-gold">{g.completed_days.length} days completed</span>
                          </div>
                          <h3 className="gf-hof-title">{g.smart_title}</h3>
                          <p className="gf-hof-desc">{g.smart_description}</p>
                          {g.raw_input && (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', marginTop: 6 }}>
                              &ldquo;{g.raw_input}&rdquo;
                            </div>
                          )}
                          <div className="gf-bar gf-bar-gold" style={{ marginTop: 10 }}>
                            <div className="gf-bar-fill" style={{ width: '100%' }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !isError && !analytics && (
          <div className="gf-card" style={{ textAlign: 'center', padding: '48px 22px', borderStyle: 'dashed' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 13, color: 'var(--text-mute)' }}>
              Create your first goal to unlock analytics.
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
