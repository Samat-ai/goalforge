import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/react'
import AppHeader from '../components/AppHeader'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getStage, streak, bestStreak, todayStr, daysAgo } from '../lib/gamification'
import { T } from '../lib/theme'
import {
  useAllGoalsQuery,
  useBadgesQuery,
  useCreateWeeklyReflectionMutation,
  useLatestWeeklyReflectionQuery,
  useProfileQuery,
} from '../hooks'
import QueryErrorBoundary from '../components/QueryErrorBoundary'

// ── Analytics page ────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user } = useUser()

  const { goals, isLoading: loading, isError, refetch } = useAllGoalsQuery(user?.id)
  const { pts } = useProfileQuery(user?.id)
  const { badges } = useBadgesQuery(user?.id)
  const { reflection } = useLatestWeeklyReflectionQuery(user?.id)
  const { createReflection, isSaving } = useCreateWeeklyReflectionMutation(user?.id ?? '')
  const [wentWell, setWentWell] = useState('')
  const [blockers, setBlockers] = useState('')
  const [weekRating, setWeekRating] = useState(3)

  const error = isError ? 'Failed to load data.' : null

  useEffect(() => { document.title = 'Analytics — GoalForge' }, [])

  // ── Derived analytics data ──
  const analytics = useMemo(() => {
    if (!goals.length) return null

    const today = todayStr()

    // All completed days across all goals (deduplicated)
    const allCompletedDays = [...new Set(goals.flatMap(g => g.completed_days))].sort()

    // All tasks with completed_at timestamps
    const allTasks = goals.flatMap(g => g.daily_tasks)
    const completedTasks = allTasks.filter(t => t.is_completed)

    // Current streak & personal best
    const currentStreak = streak(allCompletedDays)
    const personalBest = bestStreak(allCompletedDays)

    // Week-over-week: tasks completed in last 7 days vs 7 days before that
    const thisWeekStart = daysAgo(today, 6)
    const lastWeekStart = daysAgo(today, 13)
    const thisWeekCount = completedTasks.filter(t => {
      if (!t.completed_at) return false
      const d = new Intl.DateTimeFormat('en-CA').format(new Date(t.completed_at))
      return d >= thisWeekStart && d <= today
    }).length
    const lastWeekCount = completedTasks.filter(t => {
      if (!t.completed_at) return false
      const d = new Intl.DateTimeFormat('en-CA').format(new Date(t.completed_at))
      return d >= lastWeekStart && d < thisWeekStart
    }).length

    // Week-aligned heatmap data (~13 weeks, Sun-Sat columns)
    const tasksByDate = new Map<string, number>()
    for (const t of completedTasks) {
      if (!t.completed_at) continue
      const d = new Intl.DateTimeFormat('en-CA').format(new Date(t.completed_at))
      tasksByDate.set(d, (tasksByDate.get(d) ?? 0) + 1)
    }

    // Find the Sunday 13 weeks ago
    const todayDate = new Date(today + 'T12:00:00')
    const todayDow = todayDate.getDay() // 0=Sun
    const endOfWeekSat = new Date(todayDate)
    endOfWeekSat.setDate(todayDate.getDate() + (6 - todayDow)) // this Saturday
    const startSunday = new Date(endOfWeekSat)
    startSunday.setDate(endOfWeekSat.getDate() - (13 * 7 - 1)) // 13 weeks back

    const heatmapWeeks: { date: string; count: number; dow: number }[][] = []
    const heatmapMonthLabels: { col: number; label: string }[] = []
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let prevMonth = -1
    const cursor = new Date(startSunday)
    for (let week = 0; week < 13; week++) {
      const weekDays: { date: string; count: number; dow: number }[] = []
      for (let dow = 0; dow < 7; dow++) {
        const d = new Intl.DateTimeFormat('en-CA').format(cursor)
        const isFuture = d > today
        weekDays.push({ date: d, count: isFuture ? -1 : (tasksByDate.get(d) ?? 0), dow })
        // Month label on first day of a new month in this column
        if (dow === 0 && cursor.getMonth() !== prevMonth) {
          heatmapMonthLabels.push({ col: week, label: monthNames[cursor.getMonth()] })
          prevMonth = cursor.getMonth()
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      heatmapWeeks.push(weekDays)
    }

    // 7-day velocity
    const velocityDays: { label: string; count: number }[] = []
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(today, i)
      const dayOfWeek = new Date(d + 'T12:00:00').getDay()
      velocityDays.push({ label: dayNames[dayOfWeek], count: tasksByDate.get(d) ?? 0 })
    }

    // Time-of-day distribution
    const timeSlots = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 }
    for (const t of completedTasks) {
      if (!t.completed_at) continue
      const hour = new Date(t.completed_at).getHours()
      if (hour >= 5 && hour < 12) timeSlots.Morning++
      else if (hour >= 12 && hour < 17) timeSlots.Afternoon++
      else if (hour >= 17 && hour < 24) timeSlots.Evening++
      else timeSlots.Night++
    }
    const timeOfDay = Object.entries(timeSlots)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)

    return {
      allCompletedDays,
      currentStreak,
      personalBest,
      thisWeekCount,
      lastWeekCount,
      completedTasksTotal: completedTasks.length,
      heatmapWeeks,
      heatmapMonthLabels,
      velocityDays,
      timeOfDay,
    }
  }, [goals])

  const stage = getStage(pts)
  const achieved = goals.filter(g => g.status === 'achieved')

  // Week-over-week trend sentence
  const trendSentence = (() => {
    if (!analytics) return null
    const { thisWeekCount, lastWeekCount } = analytics
    if (lastWeekCount === 0 && thisWeekCount === 0) return null
    if (lastWeekCount === 0) return `You completed ${thisWeekCount} tasks this week — first week tracked!`
    const diff = thisWeekCount - lastWeekCount
    const pct = Math.round(Math.abs(diff / lastWeekCount) * 100)
    if (diff > 0) return `You completed ${thisWeekCount} tasks this week vs ${lastWeekCount} last week (+${pct}%)`
    if (diff < 0) return `You completed ${thisWeekCount} tasks this week vs ${lastWeekCount} last week (-${pct}%)`
    return `You completed ${thisWeekCount} tasks this week — same as last week`
  })()

  return (
    <div className="min-h-dvh mesh-bg" style={{ color: T.text, fontFamily: T.mono }}>
      <AppHeader pts={pts} />

      <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto' }} className="px-4 py-5 sm:px-8 sm:py-7">

        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 400, color: T.text, marginBottom: 3 }} className="text-[26px] sm:text-[32px] lg:text-[38px]">
            Analytics
          </h1>
          <p style={{ fontSize: 12, color: T.muted }}>Track your patterns, celebrate your progress</p>
        </div>

        {error && (
          <div style={{
            padding: '20px 22px', background: `${T.rose}10`, border: `1px solid ${T.rose}30`,
            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: T.rose, fontFamily: T.mono, marginBottom: 3 }}>{error}</div>
              <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>Check your connection and try again.</div>
            </div>
            <button
              onClick={() => refetch()}
              style={{
                cursor: 'pointer', padding: '7px 16px', borderRadius: 8, flexShrink: 0,
                fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
                background: `${T.rose}20`, color: T.rose, border: `1px solid ${T.rose}50`,
                minHeight: 44, minWidth: 44,
              }}
            >
              Try again
            </button>
          </div>
        )}

        {loading && (
          <div role="status" aria-label="Loading analytics" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `2px solid ${T.dim}`, borderTop: `2px solid ${T.orange}`,
              animation: 'spin 0.75s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && analytics && (
          <QueryErrorBoundary section="analytics">
            {/* ═══ SECTION 1: OVERVIEW ═══ */}
            <section style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 14 }}>
                OVERVIEW
              </div>

              {/* Stat grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 11, marginBottom: 14 }}>
                {[
                  { label: 'Active Goals', value: goals.filter(g => g.status === 'active').length, color: T.orange },
                  { label: 'Tasks Completed', value: analytics.completedTasksTotal, color: T.emerald },
                  { label: 'Star Points', value: pts, color: stage.color },
                  { label: 'Current Streak', value: `${analytics.currentStreak}d`, color: T.amber },
                  { label: 'Personal Best', value: `${analytics.personalBest}d`, color: T.indigo },
                ].map(s => (
                  <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: '13px 15px' }}>
                    <div style={{ fontFamily: T.mono, fontSize: 26, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Week-over-week trend */}
              {trendSentence && (
                <div style={{
                  fontSize: 12, color: T.textDim, fontFamily: T.mono, padding: '10px 14px',
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
                }}>
                  {trendSentence}
                </div>
              )}
            </section>

            {/* ═══ SECTION 2: TRENDS ═══ */}
            <section style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 14 }}>
                TRENDS
              </div>

              {/* Completion Heatmap */}
              <div style={{
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
                padding: '16px 18px', marginBottom: 14, overflowX: 'auto',
              }}>
                <div style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, marginBottom: 12 }}>
                  Completion Heatmap
                </div>
                <div style={{ display: 'flex', gap: 0 }}>
                  {/* Y-axis day labels */}
                  <div style={{
                    display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gap: 2,
                    paddingRight: 6, paddingTop: 18,
                  }}>
                    {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
                      <div key={i} style={{
                        fontSize: 9, color: T.dim, fontFamily: T.mono,
                        lineHeight: '12px', textAlign: 'right',
                      }}>
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Grid area */}
                  <div>
                    {/* X-axis month labels */}
                    <div style={{ display: 'flex', height: 14, marginBottom: 2 }}>
                      {analytics.heatmapWeeks.map((_, weekIdx) => {
                        const monthLabel = analytics.heatmapMonthLabels.find(m => m.col === weekIdx)
                        return (
                          <div key={weekIdx} style={{
                            width: 14, fontSize: 9, color: T.dim,
                            fontFamily: T.mono, textAlign: 'left',
                          }}>
                            {monthLabel?.label ?? ''}
                          </div>
                        )
                      })}
                    </div>

                    {/* Heatmap cells */}
                    <div style={{
                      display: 'grid',
                      gridTemplateRows: 'repeat(7, 12px)',
                      gridAutoFlow: 'column',
                      gridAutoColumns: '12px',
                      gap: 2,
                    }}>
                      {analytics.heatmapWeeks.flatMap(week =>
                        week.map(d => {
                          if (d.count < 0) {
                            // Future day — invisible spacer
                            return <div key={d.date} style={{ borderRadius: 2 }} />
                          }
                          const intensity = d.count === 0 ? 0 : d.count <= 2 ? 1 : d.count <= 4 ? 2 : 3
                          const colors = [T.surface, `${T.emerald}40`, `${T.emerald}80`, T.emerald]
                          return (
                            <div
                              key={d.date}
                              title={`${d.date}: ${d.count} task${d.count !== 1 ? 's' : ''}`}
                              style={{
                                aspectRatio: '1',
                                borderRadius: 2,
                                background: colors[intensity],
                                minWidth: 0,
                              }}
                            />
                          )
                        })
                      )}
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 9, color: T.dim, fontFamily: T.mono }}>Less</span>
                      {[T.surface, `${T.emerald}40`, `${T.emerald}80`, T.emerald].map((c, i) => (
                        <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                      ))}
                      <span style={{ fontSize: 9, color: T.dim, fontFamily: T.mono }}>More</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts row: Velocity + Time-of-Day */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* 7-Day Velocity */}
                <div style={{
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
                  padding: '16px 18px',
                }}>
                  <div style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, marginBottom: 12 }}>
                    7-Day Velocity
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analytics.velocityDays} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: T.dim }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: T.mono, fontSize: 11 }}
                        labelStyle={{ color: T.text }}
                        itemStyle={{ color: T.orange }}
                        cursor={{ fill: `${T.orange}10` }}
                      />
                      <Bar dataKey="count" name="Tasks" fill={T.orange} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Time-of-Day Distribution */}
                <div style={{
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
                  padding: '16px 18px',
                }}>
                  <div style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, marginBottom: 12 }}>
                    Time of Day
                  </div>
                  {analytics.timeOfDay.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={analytics.timeOfDay}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                        >
                          {analytics.timeOfDay.map((entry, i) => {
                            const palette = [T.amber, T.orange, T.indigo, T.emerald]
                            return <Cell key={entry.name} fill={palette[i % palette.length]} />
                          })}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: T.mono, fontSize: 11 }}
                          itemStyle={{ color: T.text }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: T.dim, fontSize: 12, fontFamily: T.mono }}>
                      Complete tasks to see your pattern
                    </div>
                  )}
                  {analytics.timeOfDay.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                      {analytics.timeOfDay.map((entry, i) => {
                        const palette = [T.amber, T.orange, T.indigo, T.emerald]
                        return (
                          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: palette[i % palette.length] }} />
                            <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>{entry.name} ({entry.value})</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ═══ SECTION 3: REFLECTION ═══ */}
            <section style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 14 }}>
                REFLECTION
              </div>

              {/* Weekly Reflection Form */}
              <div style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '16px 16px 14px',
                marginBottom: 14,
              }}>
                <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
                  WEEKLY REFLECTION RITUAL
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea
                    value={wentWell}
                    onChange={e => setWentWell(e.target.value)}
                    placeholder="What went well this week?"
                    rows={2}
                    style={{
                      width: '100%', resize: 'vertical', minHeight: 44, borderRadius: 8,
                      border: `1px solid ${T.border}`, background: T.surface, color: T.text,
                      padding: '10px 12px', fontFamily: T.mono, fontSize: 12,
                    }}
                  />
                  <textarea
                    value={blockers}
                    onChange={e => setBlockers(e.target.value)}
                    placeholder="What blocked you?"
                    rows={2}
                    style={{
                      width: '100%', resize: 'vertical', minHeight: 44, borderRadius: 8,
                      border: `1px solid ${T.border}`, background: T.surface, color: T.text,
                      padding: '10px 12px', fontFamily: T.mono, fontSize: 12,
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>Week rating</label>
                    <select
                      value={weekRating}
                      onChange={e => setWeekRating(Number(e.target.value))}
                      style={{
                        minHeight: 44, borderRadius: 8, border: `1px solid ${T.border}`,
                        background: T.surface, color: T.text, padding: '0 10px',
                        fontFamily: T.mono, fontSize: 12,
                      }}
                    >
                      {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button
                      onClick={() => {
                        if (wentWell.trim().length < 5 || blockers.trim().length < 5) return
                        createReflection({
                          went_well: wentWell.trim(),
                          blockers: blockers.trim(),
                          week_rating: weekRating,
                        })
                        setWentWell('')
                        setBlockers('')
                      }}
                      disabled={isSaving}
                      style={{
                        minHeight: 44, minWidth: 44, borderRadius: 8,
                        border: `1px solid ${T.indigo}`, background: `${T.indigo}18`,
                        color: T.indigo, padding: '0 14px', fontFamily: T.mono,
                        fontSize: 11, letterSpacing: '0.05em',
                        cursor: isSaving ? 'default' : 'pointer',
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      Save Reflection
                    </button>
                  </div>

                  {reflection && (
                    <div style={{
                      marginTop: 4, borderRadius: 8, border: `1px solid ${T.emerald}40`,
                      background: `${T.emerald}10`, padding: '10px 12px',
                    }}>
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.emerald, letterSpacing: '0.08em', marginBottom: 4 }}>
                        AI COACH RECOMMENDATION
                      </div>
                      <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>
                        {reflection.coach_recommendation}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Achievement Badges */}
              {badges.length > 0 && (
                <div style={{
                  borderRadius: 12, border: `1px solid ${T.border}`,
                  background: T.card, padding: '12px 14px',
                }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.1em', marginBottom: 8 }}>
                    ACHIEVEMENT BADGES
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
                    {badges.map(badge => (
                      <div key={badge.key} style={{
                        borderRadius: 8,
                        border: `1px solid ${badge.unlocked ? T.emerald : T.border}`,
                        background: badge.unlocked ? `${T.emerald}10` : T.surface,
                        padding: '10px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontFamily: T.serif, fontSize: 15, color: badge.unlocked ? T.emerald : T.text }}>{badge.title}</div>
                          <div style={{ fontFamily: T.mono, fontSize: 10, color: badge.unlocked ? T.emerald : T.textDim }}>
                            {badge.current}/{badge.target}
                          </div>
                        </div>
                        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginTop: 4 }}>{badge.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ═══ SECTION 4: HALL OF FAME ═══ */}
            <section>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 14 }}>
                HALL OF FAME — {achieved.length} {achieved.length === 1 ? 'GOAL' : 'GOALS'} ACHIEVED
              </div>

              {achieved.length === 0 && (
                <div style={{
                  background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
                  padding: '36px 22px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🏆</div>
                  <div style={{ fontSize: 13, color: T.muted, fontFamily: T.mono }}>
                    No goals achieved yet. Complete your first goal to unlock the Hall of Fame.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {achieved.map(g => {
                  const s = streak(g.completed_days)
                  return (
                    <div key={g.id} style={{
                      background: T.card, border: `1px solid ${T.amber}40`,
                      borderLeft: `3px solid ${T.amber}`,
                      borderRadius: '0 12px 12px 0', padding: '18px',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{
                        position: 'absolute', top: -30, right: -30,
                        width: 100, height: 100, borderRadius: '50%',
                        background: `radial-gradient(circle, ${T.amber}12, transparent)`,
                        pointerEvents: 'none',
                      }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <span style={{ fontSize: 28, flexShrink: 0 }}>🏆</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 20,
                              fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em',
                              border: `1px solid ${T.amber}50`, background: `${T.amber}15`, color: T.amber,
                            }}>
                              {g.goal_type}
                            </span>
                            {s > 0 && (
                              <span style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 20,
                                fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em',
                                border: `1px solid ${T.orange}50`, background: `${T.orange}15`, color: T.orange,
                              }}>
                                {s}d streak
                              </span>
                            )}
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 20,
                              fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em',
                              border: `1px solid ${T.emerald}50`, background: `${T.emerald}15`, color: T.emerald,
                            }}>
                              {g.completed_days.length} days completed
                            </span>
                          </div>
                          <div style={{ fontFamily: T.serif, fontSize: 16, color: T.amber, marginBottom: 4, lineHeight: 1.4 }}>
                            {g.smart_title}
                          </div>
                          <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 4 }}>
                            {g.smart_description}
                          </div>
                          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>"{g.raw_input}"</div>
                          {g.progress > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ height: 4, background: T.dim, borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: 2, background: T.amber,
                                  width: `${g.progress}%`, transition: 'width 0.7s',
                                }} />
                              </div>
                              <div style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, marginTop: 3 }}>
                                {g.progress}% progress tracked
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </QueryErrorBoundary>
        )}

        {/* Empty state for users with no goals */}
        {!loading && !error && !analytics && (
          <div style={{
            background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
            padding: '48px 22px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: T.mono }}>
              Create your first goal to unlock analytics.
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
