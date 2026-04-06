import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/react'
import AppHeader from '../components/AppHeader'
import { getStage, streak, bestStreak, todayStr, daysAgo } from '../lib/gamification'
import { T } from '../lib/theme'
import {
  useAllGoalsQuery,
  useBadgesQuery,
  useCreateWeeklyReflectionMutation,
  useLatestWeeklyReflectionQuery,
  useProfileQuery,
} from '../hooks'

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

    // 90-day heatmap data
    const heatmapDays: { date: string; count: number }[] = []
    const tasksByDate = new Map<string, number>()
    for (const t of completedTasks) {
      if (!t.completed_at) continue
      const d = new Intl.DateTimeFormat('en-CA').format(new Date(t.completed_at))
      tasksByDate.set(d, (tasksByDate.get(d) ?? 0) + 1)
    }
    for (let i = 89; i >= 0; i--) {
      const d = daysAgo(today, i)
      heatmapDays.push({ date: d, count: tasksByDate.get(d) ?? 0 })
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
      heatmapDays,
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
          <>
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

            {/* ═══ SECTION 2: TRENDS — filled in by Task 4 ═══ */}

            {/* ═══ SECTION 3: REFLECTION — filled in by Task 5 ═══ */}

            {/* ═══ SECTION 4: HALL OF FAME — filled in by Task 5 ═══ */}
          </>
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
