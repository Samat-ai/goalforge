// pages/AnalyticsPage.tsx — patterns & progress dashboard.
// Transcribed from design_handoff_goalforge/app/gf-analytics.jsx. All mock data
// (data.velocity / data.heatmap / data.timeOfDay / data.stats / data.badges /
// data.achieved) is replaced with real derivations — see lib/analyticsView.ts
// (mirrors gf-data.jsx:134-174 shapes) and real hooks (useAllGoalsQuery,
// useBadgesQuery, useLatestWeeklyReflectionQuery, useProfileQuery).
import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/react'
import { Icon, Reveal, Ring, Sparkline } from '../components/gf/Ui'
import { cx, useCountUp, gfTip, gfHideTip } from '../components/gf/util'
import {
  useAllGoalsQuery,
  useBadgesQuery,
  useCreateWeeklyReflectionMutation,
  useLatestWeeklyReflectionQuery,
  useProfileQuery,
} from '../hooks'
import { getStage, todayStr } from '../lib/gamification'
import { buildHeatmap, buildSpark, buildStats, buildTimeOfDay, buildVelocity } from '../lib/analyticsView'
import type { AnalyticsStats, HeatmapCell, MonthLabel, TimeOfDaySlice, VelocityDay } from '../lib/analyticsView'
import type { Goal } from '../lib/types'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

// ── Big-number stat tile (Robinhood/Revolut energy) ─────────────────────────
function StatTile({
  label, value, suffix, accent, spark, trend, progress, progFill, delay,
}: {
  label: string
  value: number
  suffix?: string
  accent: string
  spark?: number[]
  trend?: { dir: 'up' | 'down'; text: string }
  progress?: { value: number; label: string }
  progFill?: string
  delay: number
}) {
  const num = useCountUp(value)
  return (
    <Reveal className="gf-stat" delay={delay}>
      <div className="gf-stat-label">{label}</div>
      <div className="gf-stat-val" style={{ color: accent }}>{num}{suffix && <span className="gf-stat-suf">{suffix}</span>}</div>
      {spark && <div className="gf-stat-spark"><Sparkline data={spark} color={accent} w={110} h={30} /></div>}
      {trend && <div className={cx('gf-stat-trend', trend.dir)}><Icon name={trend.dir === 'up' ? 'arrowUp' : 'arrowDown'} size={12} /> {trend.text}</div>}
      {progress && (
        <div className="gf-stat-prog">
          <div className="gf-stat-prog-track"><div className="gf-stat-prog-fill" style={{ width: `${Math.round(Math.min(1, progress.value) * 100)}%`, background: progFill || accent }} /></div>
          <div className="gf-stat-prog-cap">{progress.label}</div>
        </div>
      )}
    </Reveal>
  )
}

// ── Three-ring activity card (Apple Fitness) ────────────────────────────────
function ActivityRings({ stats, todayRatio }: { stats: AnalyticsStats; todayRatio: number }) {
  const rings = [
    { label: 'Today', sub: 'tasks done', value: todayRatio, color: 'var(--accent)' },
    { label: 'This week', sub: `${stats.thisWeek} of 28`, value: stats.thisWeek / 28, color: 'var(--ring-2)' },
    { label: 'Consistency', sub: '30-day strength', value: stats.consistency, color: 'var(--ring-3)' },
  ]
  return (
    <Reveal className="gf-card gf-rings" delay={80}>
      <div className="gf-card-cap">Activity</div>
      <div className="gf-rings-stack">
        <div className="gf-rings-nest">
          <div style={{ position: 'absolute', inset: 0 }}><Ring value={rings[0].value} size={150} stroke={13} color={rings[0].color} delay={200} fromRatio={0.8} /></div>
          <div style={{ position: 'absolute', inset: 19 }}><Ring value={rings[1].value} size={112} stroke={13} color={rings[1].color} delay={300} fromRatio={0.8} /></div>
          <div style={{ position: 'absolute', inset: 38 }}><Ring value={rings[2].value} size={74} stroke={13} color={rings[2].color} delay={400} fromRatio={0.8} /></div>
        </div>
        <div className="gf-rings-legend">
          {rings.map(r => (
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
    </Reveal>
  )
}

// ── Animated weekly velocity bars ───────────────────────────────────────────
function Velocity({ velocity }: { velocity: VelocityDay[] }) {
  const max = Math.max(...velocity.map(d => d.count), 1)
  const [grow, setGrow] = useState(false)
  useEffect(() => { const id = setTimeout(() => setGrow(true), 240); return () => clearTimeout(id) }, [])
  return (
    <Reveal className="gf-card" delay={140}>
      <div className="gf-card-cap">7-day velocity</div>
      <div className="gf-bars">
        {velocity.map((d, i) => (
          <div key={i} className="gf-bar-col">
            <div className="gf-bar-track">
              <div className="gf-bar-grow" style={{ height: `${(d.count / max) * 100 * (grow ? 1 : 0.72)}%`, transitionDelay: `${i * 55}ms` }}>
                <span className="gf-bar-val">{d.count}</span>
              </div>
            </div>
            <span className={cx('gf-bar-lbl', i === velocity.length - 1 && 'is-today')}>{d.label}</span>
          </div>
        ))}
      </div>
    </Reveal>
  )
}

// ── Time-of-day donut ────────────────────────────────────────────────────────
function TimeDonut({ timeOfDay }: { timeOfDay: TimeOfDaySlice[] }) {
  const total = timeOfDay.reduce((s, d) => s + d.value, 0)
  const colors = ['var(--accent)', 'var(--ring-2)', 'var(--ring-3)', 'var(--text-mute)']
  const r = 52, c = 2 * Math.PI * r
  // Prototype accumulates `acc` inline during the map; project ESLint bans render-body
  // reassignment, so the running arc offsets are precomputed instead. Same output.
  const offsets = timeOfDay.reduce<number[]>((arr, _slice, i) => {
    arr.push(i === 0 ? 0 : arr[i - 1] + c * (timeOfDay[i - 1].value / (total || 1)))
    return arr
  }, [])
  const [draw, setDraw] = useState(false)
  const [active, setActive] = useState(-1)
  useEffect(() => { const id = setTimeout(() => setDraw(true), 260); return () => clearTimeout(id) }, [])
  return (
    <Reveal className="gf-card" delay={180}>
      <div className="gf-card-cap">Time of day</div>
      {total === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-mute)', fontSize: 12 }}>
          Complete tasks to see your pattern
        </div>
      ) : (
        <div className="gf-donut-wrap">
          <svg className={cx('gf-donut-svg', active >= 0 && 'is-dim')} width="132" height="132" viewBox="0 0 132 132" style={{ transform: 'rotate(-90deg)' }}>
            {timeOfDay.map((d, i) => {
              const frac = d.value / total
              const ratio = draw ? 1 : 0.82
              const len = c * frac * ratio
              return (
                <circle key={i} className={cx('gf-donut-seg', active === i && 'is-on')} cx="66" cy="66" r={r} fill="none" stroke={colors[i]}
                  strokeWidth={active === i ? 17 : 14}
                  strokeDasharray={`${len} ${c}`} strokeDashoffset={-offsets[i]} strokeLinecap="butt"
                  onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(-1)}
                  style={{ transition: `stroke-dasharray .8s cubic-bezier(.22,.61,.36,1) ${i * 70}ms, stroke-width .18s ease, opacity .18s ease` }} />
              )
            })}
          </svg>
          <div className="gf-donut-legend">
            {timeOfDay.map((d, i) => (
              <div key={d.name} className={cx('gf-legrow gf-legrow-int', active === i && 'is-active')}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(-1)}>
                <span className="gf-legdot" style={{ background: colors[i] }} />
                <div className="gf-leg-label">{d.name}</div>
                <div className="gf-leg-pct">{Math.round((d.value / total) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Reveal>
  )
}

// ── Completion heatmap — GitHub-style contribution grid ─────────────────────
const HEAT_ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HEAT_LEVEL_BG = [
  'var(--ring-track)',
  'color-mix(in oklab, var(--accent) 26%, transparent)',
  'color-mix(in oklab, var(--accent) 48%, transparent)',
  'color-mix(in oklab, var(--accent) 72%, transparent)',
  'var(--accent)',
]
function heatLevel(n: number) { return n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4 }

const HM_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const HM_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function prettyDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${HM_DOW[dt.getDay()]}, ${HM_MON[m - 1]} ${d}`
}

function Heatmap({ weeks, monthLabels }: { weeks: HeatmapCell[][]; monthLabels: MonthLabel[] }) {
  const nWeeks = weeks.length
  const cells = []
  for (let w = 0; w < nWeeks; w++) {
    for (let r = 0; r < 7; r++) {
      const dow = (r + 1) % 7
      const d = weeks[w][dow]
      const future = !d || d.count < 0
      const l = future ? -1 : heatLevel(d.count)
      const tip = future ? '' : `<b>${d.count}</b> task${d.count === 1 ? '' : 's'}<span>${prettyDate(d.date)}</span>`
      cells.push(
        <span key={w + '-' + r}
          className={cx('hm-cell', future && 'is-empty')}
          style={{ background: future ? 'transparent' : HEAT_LEVEL_BG[l] }}
          onMouseMove={future ? undefined : (e) => gfTip(e, tip)}
          onMouseLeave={future ? undefined : gfHideTip} />,
      )
    }
  }
  return (
    <Reveal className="gf-card gf-heat" delay={100}>
      <div className="gf-card-cap">Completion heatmap <span style={{ color: 'var(--text-mute)', textTransform: 'none', letterSpacing: 0 }}>last 4 months</span></div>
      <div className="hm-months">
        {monthLabels.map((m, i) => (
          <span key={m.label + i} style={{ marginLeft: i === 0 ? 0 : (m.col - monthLabels[i - 1].col) * 17 - 17 }}>{m.label}</span>
        ))}
      </div>
      <div className="hm-wrap">
        <div className="hm-days">
          {HEAT_ROWS.map((dname, i) => <span key={dname}>{i % 2 === 0 ? dname : ''}</span>)}
        </div>
        <div className="hm-grid">{cells}</div>
      </div>
      <div className="hm-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(l => <span key={l} className="hm-cell" style={{ background: HEAT_LEVEL_BG[l] }} />)}
        <span>More</span>
      </div>
    </Reveal>
  )
}

// ── Weekly reflection ritual ─────────────────────────────────────────────────
function Reflection({ userId }: { userId: string }) {
  const { reflection } = useLatestWeeklyReflectionQuery(userId)
  const { createReflection, isSaving } = useCreateWeeklyReflectionMutation(userId)
  const [well, setWell] = useState('')
  const [block, setBlock] = useState('')
  const [rating, setRating] = useState(4)

  function save() {
    if (isSaving) return
    if (well.trim().length < 5 || block.trim().length < 5) return
    createReflection({ went_well: well.trim(), blockers: block.trim(), week_rating: rating })
    setWell('')
    setBlock('')
  }

  return (
    <Reveal className="gf-card" delay={140}>
      <div className="gf-card-cap">Weekly reflection ritual</div>
      <div className="gf-refl">
        <textarea className="gf-textarea" rows={2} placeholder="What went well this week?" value={well} onChange={e => setWell(e.target.value)} />
        <textarea className="gf-textarea" rows={2} placeholder="What blocked you?" value={block} onChange={e => setBlock(e.target.value)} />
        <div className="gf-refl-row">
          <span className="gf-refl-lbl">Week rating</span>
          <div className="gf-stars">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} className={cx('gf-star', n <= rating && 'is-on')} onClick={() => setRating(n)} aria-label={`${n} stars`}><Icon name="spark" size={16} /></button>
            ))}
          </div>
          <button className="gf-btn gf-btn-accent" style={{ marginLeft: 'auto' }} disabled={isSaving} onClick={save}>Save</button>
        </div>
        {reflection && (
          <div className="gf-coach">
            <div className="gf-coach-cap"><Icon name="spark" size={11} /> AI coach recommendation</div>
            <div className="gf-coach-body">{reflection.coach_recommendation}</div>
          </div>
        )}
      </div>
    </Reveal>
  )
}

// ── Achievement badges ───────────────────────────────────────────────────────
function Badges({ userId }: { userId: string }) {
  const { badges } = useBadgesQuery(userId)
  if (!badges.length) return null
  return (
    <Reveal className="gf-card" delay={120}>
      <div className="gf-card-cap">Achievement badges</div>
      <div className="gf-badges">
        {badges.map(b => (
          <div key={b.key} className={cx('gf-badge', b.unlocked && 'is-on')}>
            <div className="gf-badge-ic"><Icon name={b.unlocked ? 'trophy' : 'target'} size={16} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gf-badge-title">{b.title}</div>
              <div className="gf-badge-desc">{b.description}</div>
            </div>
            <div className="gf-badge-prog">{Math.min(b.current, b.target)}/{b.target}</div>
          </div>
        ))}
      </div>
    </Reveal>
  )
}

// ── Hall of fame (achieved goals) ────────────────────────────────────────────
function HallOfFame({ achieved }: { achieved: Goal[] }) {
  return (
    <div>
      <Reveal as="div" className="gf-section-cap" delay={60}>Hall of fame · {achieved.length} achieved</Reveal>
      <div className="gf-goallist">
        {achieved.map((g, i) => (
          <Reveal key={g.id} className="gf-card gf-hof" delay={90 + i * 80}>
            <div className="gf-hof-ic"><Icon name="trophy" size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gf-goal-meta">
                <span className="gf-chip gf-chip-gold">{g.goal_type}</span>
                <span className="gf-chip gf-chip-gold-soft">{g.completed_days.length} days</span>
              </div>
              <h3 className="gf-hof-title">{g.smart_title}</h3>
              <p className="gf-hof-desc">{g.smart_description}</p>
              <div className="gf-bar gf-bar-gold"><div className="gf-bar-fill" style={{ width: '100%' }} /></div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}

// ── Analytics page ────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)

  const { goals, isLoading: loading, isError, refetch } = useAllGoalsQuery(userId)
  const { pts } = useProfileQuery(userId)

  useEffect(() => { document.title = 'Analytics — GoalForge' }, [])

  const today = todayStr()
  const velocity = useMemo(() => buildVelocity(goals, today), [goals, today])
  const heatmap = useMemo(() => buildHeatmap(goals, today), [goals, today])
  const timeOfDay = useMemo(() => buildTimeOfDay(goals), [goals])
  const stats = useMemo(() => buildStats(goals, { pts }, today), [goals, pts, today])
  const streakSpark = useMemo(() => buildSpark(goals, 10, today), [goals, today])

  const todayTasks = goals.filter(g => g.status === 'active').flatMap(g => g.daily_tasks.filter(t => t.assigned_date === today))
  const todayRatio = todayTasks.length ? todayTasks.filter(t => t.is_completed).length / todayTasks.length : 0
  const achieved = goals.filter(g => g.status === 'achieved')

  // Prototype computes `+${pct}% vs last week` unconditionally; with real data the
  // trend can go down (or last week can be 0), so direction/sign follow the data.
  const diff = stats.thisWeek - stats.lastWeek
  const trend = (() => {
    if (stats.lastWeek === 0 && stats.thisWeek === 0) return undefined
    if (stats.lastWeek === 0) return { dir: 'up' as const, text: `${stats.thisWeek} this week` }
    const pct = Math.round(Math.abs(diff / stats.lastWeek) * 100)
    if (diff >= 0) return { dir: 'up' as const, text: `+${pct}% vs last week` }
    return { dir: 'down' as const, text: `-${pct}% vs last week` }
  })()
  const stage = getStage(stats.starPoints)

  return (
    <div className="gf-page">
      {loading && (
        <div role="status" aria-label="Loading analytics" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--ring-track)', borderTop: '2px solid var(--accent)', animation: 'spin 0.75s linear infinite' }} />
        </div>
      )}

      {!loading && isError && (
        <div className="gf-nudge is-rose">
          <div className="gf-nudge-body">
            <div className="gf-nudge-kicker">Load error</div>
            <div className="gf-nudge-title">Failed to load analytics data.</div>
          </div>
          <button onClick={() => refetch()} className="gf-btn-ghost-accent">Try again</button>
        </div>
      )}

      {!loading && !isError && goals.length === 0 && (
        <div className="gf-empty">
          <div className="gf-empty-ic"><Icon name="chart" size={26} /></div>
          <div className="gf-empty-t">Create your first goal to unlock analytics.</div>
        </div>
      )}

      {!loading && !isError && goals.length > 0 && (
        <>
          <Reveal delay={20}>
            <div className="gf-eyebrow">Your patterns</div>
          </Reveal>

          <div className="gf-statgrid">
            <StatTile label="Current streak" value={stats.currentStreak} suffix="d" accent="var(--accent)" delay={40} spark={streakSpark} />
            <StatTile label="Tasks completed" value={stats.tasksCompleted} accent="var(--ring-2)" delay={80} trend={trend} />
            <StatTile label="Star points" value={stats.starPoints} accent="var(--ring-3)" delay={120} trend={{ dir: 'up', text: stage.name }} />
            <StatTile label="Personal best" value={stats.personalBest} suffix="d" accent="var(--text)" delay={160} progFill="var(--accent)"
              progress={stats.personalBest > 0 ? { value: stats.currentStreak / stats.personalBest, label: `${Math.max(0, stats.personalBest - stats.currentStreak)} days to a new best` } : undefined} />
          </div>

          <div className="gf-grid-2">
            <ActivityRings stats={stats} todayRatio={todayRatio} />
            <Velocity velocity={velocity} />
          </div>

          <div className="gf-grid-2">
            <Heatmap weeks={heatmap.weeks} monthLabels={heatmap.monthLabels} />
            <TimeDonut timeOfDay={timeOfDay} />
          </div>

          <div className="gf-grid-2">
            {userId && <Reflection userId={userId} />}
            {userId && <Badges userId={userId} />}
          </div>

          {achieved.length > 0 && <HallOfFame achieved={achieved} />}
        </>
      )}
    </div>
  )
}
