import { useState, useRef, useEffect, useId } from 'react'
import { motion } from 'motion/react'
import { T } from '../lib/theme'
import { todayStr, streak, starBrightness, lastStreakLength } from '../lib/gamification'
import Icon from './ui/Icon'
import Btn from './ui/Btn'
import SprintRail from './SprintRail'
import DailyTaskList from './DailyTaskList'
import { useGoalMutations } from '../hooks'
import { useTaskRestoreMutation } from '../hooks/useEnergyMutations'
import type { Goal, RewardDrop } from '../lib/types'

// ── PuffyStar ─────────────────────────────────────────────────────────────────
function PuffyStar({ brightness }: { brightness: number }) {
  const uid = useId()
  const n = brightness
  return (
    <div className="gf-puffy" style={{ width: 52, height: 52 }}>
      <div className="gf-puffy-glow" style={{ background: `radial-gradient(circle, rgba(251,191,36,${(0.1 + n * 0.28).toFixed(2)}) 30%, transparent 75%)` }} />
      <svg viewBox="0 0 100 100" style={{ position: 'relative', zIndex: 1, width: 44, height: 44, overflow: 'visible' }}>
        <defs>
          <radialGradient id={`ps-g-${uid}`} cx="40%" cy="28%" r="68%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#FFFBEB" />
            <stop offset="28%"  stopColor="#FDE047" />
            <stop offset="68%"  stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" stopOpacity={0.2 + n * 0.75} />
          </radialGradient>
          <filter id={`ps-f-${uid}`} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 22 -9" in="blur" result="roundedAlpha" />
            <feComposite in="SourceGraphic" in2="roundedAlpha" operator="in" />
          </filter>
        </defs>
        <polygon
          points="50,12 59.9,36.2 86.1,38.3 66.2,55.3 72.4,80.7 50,67 27.6,80.7 33.8,55.3 13.9,38.3 40.1,36.2"
          fill={`url(#ps-g-${uid})`}
          filter={`url(#ps-f-${uid})`}
        />
      </svg>
    </div>
  )
}

// ── WeekCalendar ──────────────────────────────────────────────────────────────
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function WeekCalendar({ completedDays }: { completedDays: string[] }) {
  const doneSet = new Set(completedDays)
  const today = new Date()
  const totalDays = 56
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - (totalDays - 1))
  const dayOfWeek = (startDate.getDay() + 6) % 7
  startDate.setDate(startDate.getDate() - dayOfWeek)

  const cells: ('done' | 'miss' | 'future')[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    cells.push(d > today ? 'future' : doneSet.has(iso) ? 'done' : 'miss')
  }

  const weeks: ('done' | 'miss' | 'future')[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div className="gf-cal">
      <div className="gf-cal-labels">
        {DAY_LABELS.map((d, i) => <span key={i} className="gf-cal-lbl">{d}</span>)}
      </div>
      <div className="gf-cal-weeks">
        {weeks.map((week, wi) => (
          <div key={wi} className="gf-cal-col">
            {week.map((state, di) => (
              <span key={di} className={`gf-cal-cell${state === 'done' ? ' is-done' : state === 'future' ? ' is-future' : ''}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── StreakBars ────────────────────────────────────────────────────────────────
function StreakBars({ completedDays }: { completedDays: string[] }) {
  const doneSet = new Set(completedDays)
  const today = new Date()
  const totalDays = 56
  const days: boolean[] = []
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(doneSet.has(d.toISOString().slice(0, 10)))
  }

  const streaks: { start: number; length: number }[] = []
  let i = 0
  while (i < days.length) {
    if (days[i]) {
      const start = i
      while (i < days.length && days[i]) i++
      streaks.push({ start, length: i - start })
    } else i++
  }

  const longest = Math.max(...streaks.map(s => s.length), 1)
  let currentLen = 0
  if (days[days.length - 1]) {
    let j = days.length - 1
    while (j >= 0 && days[j]) { currentLen++; j-- }
  }
  const totalDone = days.filter(Boolean).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'Current', value: currentLen, color: T.orange },
          { label: 'Longest', value: longest, color: T.text },
          { label: 'Total', value: totalDone, color: T.text },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 18, color, fontFamily: T.serif, lineHeight: 1 }}>
              {value}<span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, marginLeft: 4 }}>days</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', height: 48 }}>
        <div style={{ position: 'absolute', top: 19, left: 0, right: 0, height: 3, background: T.dim, borderRadius: 99 }} />
        {streaks.map((s, idx) => {
          const left = (s.start / totalDays) * 100
          const width = Math.max((s.length / totalDays) * 100, 0.5)
          const isLongest = s.length === longest
          const isCurrent = idx === streaks.length - 1 && days[days.length - 1]
          const barH = 4 + Math.round((s.length / longest) * 20)
          return (
            <motion.div key={idx} title={`${s.length}-day streak`}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: idx * 0.04, duration: 0.35, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: `${left}%`, width: `${width}%`,
                height: barH, top: `${19.5 - barH / 2}px`,
                borderRadius: 3, transformOrigin: 'bottom',
                background: isCurrent
                  ? 'linear-gradient(180deg,#fb923c,#f97316)'
                  : isLongest ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.25)',
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -4 }}>
        {['Day 1', `Day ${Math.round(totalDays / 2)}`, `Day ${totalDays}`].map((l, idx) => (
          <span key={idx} style={{ fontSize: 9, color: T.dim, fontFamily: T.mono }}>{l}</span>
        ))}
      </div>
    </div>
  )
}

// ── HistoryTabContent ─────────────────────────────────────────────────────────
type HistoryView = 'calendar' | 'streaks'

function HistoryTabContent({ goal, b }: { goal: Goal; b: number }) {
  const [view, setView] = useState<HistoryView>('streaks')

  return (
    <div className="gf-tabpane">
      {/* Star brightness */}
      <div>
        <div className="gf-hh">
          <span className="gf-cap2">Star Brightness</span>
          <span className="gf-hh-r">{Math.round(b * 100)}%</span>
        </div>
        <div className="gf-bar gf-bar-gold">
          <div className="gf-bar-fill" style={{ width: `${b * 100}%`, background: 'linear-gradient(90deg,#f97316,#fbbf24)' }} />
        </div>
        <div className="gf-ov-sub" style={{ marginTop: 6 }}>
          {b < 0.3 ? 'Almost out — complete tasks to recharge' : b < 0.6 ? 'Fading — keep going' : 'Burning bright'}
        </div>
      </div>

      {/* Completion history with toggle */}
      <div>
        <div className="gf-hh">
          <span className="gf-cap2">
            Completion History <span className="gf-hh-dim">{goal.completed_days.length} days</span>
          </span>
          <div className="gf-toggle">
            {(['calendar', 'streaks'] as HistoryView[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`gf-toggle-b${view === v ? ' is-on' : ''}`}>
                {v === 'calendar' ? 'weeks' : 'streaks'}
              </button>
            ))}
          </div>
        </div>
        {view === 'calendar'
          ? <WeekCalendar completedDays={goal.completed_days} />
          : <StreakBars completedDays={goal.completed_days} />
        }
      </div>

      {/* About this goal */}
      <div className="gf-about">
        <div className="gf-cap2 mb-7">About this goal</div>
        <p className="gf-about-d">{goal.smart_description}</p>
        <p className="gf-about-q">&ldquo;{goal.raw_input}&rdquo;</p>
      </div>
    </div>
  )
}

export interface GoalCardProps {
  goal: Goal
  onJackpot?: (drop: RewardDrop) => void
  index?: number
}

export default function GoalCard({ goal, onJackpot, index = 0 }: GoalCardProps) {
  const mutations = useGoalMutations(goal.user_id, onJackpot)
  const restoreTaskMutation = useTaskRestoreMutation(goal.user_id)

  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'today' | 'sprints' | 'history'>('today')
  const [completingMilestone, setCompletingMilestone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const deleteTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current)  clearTimeout(deleteTimerRef.current)
      if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current)
    }
  }, [])

  function handleDeleteClick() {
    if (confirmDelete) {
      if (deleteTimerRef.current)  clearTimeout(deleteTimerRef.current)
      if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current)
      setConfirmDelete(false)
      setConfirmAbandon(false)
      mutations.deleteGoal(goal.id)
    } else {
      setConfirmDelete(true)
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  function handleAbandonClick() {
    if (confirmAbandon) {
      if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current)
      if (deleteTimerRef.current)  clearTimeout(deleteTimerRef.current)
      setConfirmAbandon(false)
      setConfirmDelete(false)
      mutations.changeStatus(goal.id, 'abandoned')
    } else {
      setConfirmAbandon(true)
      abandonTimerRef.current = setTimeout(() => setConfirmAbandon(false), 3000)
    }
  }

  // Milestone-gated computed values
  const activeMilestone      = goal.milestones.find(m => m.sprint_status === 'active')
  const failedMilestone      = goal.milestones.find(m => m.sprint_status === 'failed')
    ?? goal.milestones.find(m =>
      m.sprint_status === 'active' && !m.is_completed &&
      goal.daily_tasks.filter(t => t.milestone_id === m.id).length === 0
    )
  const nextMilestone        = activeMilestone ? goal.milestones.find(m => m.position === activeMilestone.position + 1) : undefined
  const currentSprintTasks   = activeMilestone ? goal.daily_tasks.filter(t => t.milestone_id === activeMilestone.id) : []
  const allSprintTasksDone   = currentSprintTasks.length > 0 && currentSprintTasks.every(t => t.is_completed)
  const allMilestonesComplete = goal.milestones.length > 0 && goal.milestones.every(m => m.is_completed)
  const milestonesProgress   = goal.milestones_total > 0 ? Math.round((goal.milestones_completed / goal.milestones_total) * 100) : 0

  const isGenerating = goal.milestones.some(m => m.sprint_status === 'generating')
  const isRescueMode = goal.rescue_mode && !isGenerating

  const DISMISS_KEY = `rescue_dismissed_${goal.id}`
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    return Date.now() - Number(ts) < 8 * 60 * 60 * 1000
  })

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  async function handleStartEasyMode() {
    if (mutations.isTriggeringRescue) return
    try {
      await mutations.triggerRescue(goal.id)
      handleDismiss()
    } catch {
      // Error toast is surfaced by the mutation's onError path.
    }
  }

  const todayTasks  = goal.daily_tasks
    .filter(t => t.assigned_date === todayStr())
    .sort((a, b) => a.position - b.position)
  const completedTodayCount = todayTasks.filter(t => t.is_completed).length
  const completionRatio = todayTasks.length > 0 ? completedTodayCount / todayTasks.length : 0
  const doneToday   = todayTasks.length > 0 && todayTasks.every(t => t.is_completed)
  const s           = streak(goal.completed_days)
  const lastStreak  = lastStreakLength(goal.completed_days)
  const b           = goal.status === 'achieved' ? 1 : starBrightness(goal.completed_days)
  const isAbandoned = goal.status === 'abandoned'
  const isAchieved  = goal.status === 'achieved'
  const today       = todayStr()
  const overdueTasks = activeMilestone
    ? goal.daily_tasks
        .filter(t => t.milestone_id === activeMilestone.id && !t.is_completed && t.assigned_date < today)
        .sort((x, y) => x.assigned_date.localeCompare(y.assigned_date) || x.position - y.position)
    : []

  const days  = Math.round((new Date(goal.target_date).getTime() - new Date(today).getTime()) / 864e5)
  const dl    = days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d left`

  const tabIndex = (['today', 'sprints', 'history'] as const).indexOf(activeTab)

  // Suppress TypeScript unused warning — index is used in future animation delay
  void index

  return (
    <div
      className={`gf-card gf-gc${isAchieved ? ' goal-achieved' : ''}`}
      style={{
        opacity: isAbandoned ? 0.5 : 1,
        ...(isAbandoned
          ? { borderColor: 'rgba(107,108,132,0.25)' }
          : open ? { borderColor: 'var(--border-hi)' } : {}),
        ...(completionRatio > 0 && !isAbandoned
          ? { boxShadow: `0 0 ${Math.round(8 + completionRatio * 12)}px rgba(16,185,129,${(Math.max(0.08, 0.04 + completionRatio * 0.1)).toFixed(2)})` }
          : {}),
      }}
    >
      {/* ── Header row ── */}
      <button
        className="gf-gc-head"
        aria-expanded={open}
        aria-label={`${goal.smart_title} — click to ${open ? 'collapse' : 'expand'}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
      >
        <PuffyStar brightness={b} />

        <div className="gf-gc-mid">
          <div className="gf-gc-badges">
            {!isGenerating && <span className={`gf-chip t-${goal.goal_type}`}>{goal.goal_type}</span>}
            {isGenerating  && <span className="gf-chip gf-chip-muted">generating…</span>}
            {isAbandoned   && <span className="gf-chip gf-chip-muted">abandoned</span>}
            {isAchieved    && <span className="gf-chip gf-chip-gold">✦ achieved</span>}
            {doneToday && !isAbandoned && !isAchieved && <span className="gf-chip gf-chip-ok">✓ done today</span>}
            {s > 0 && !isAbandoned && <span className="gf-chip gf-chip-flame">{s}d streak</span>}
            {s === 0 && lastStreak >= 2 && !isAbandoned && !isAchieved && <span className="gf-chip gf-chip-muted">last: {lastStreak}d</span>}
            {goal.target_date && <span className={`gf-chip${days < 0 ? ' gf-chip-over' : ' gf-chip-muted'}`}>{dl}</span>}
          </div>
          <div className={`gf-gc-title${isAbandoned ? ' is-muted' : ''}`}>
            {goal.smart_title}
          </div>
        </div>

        <span className={`gf-gc-chev${open ? ' is-open' : ''}`}>
          <Icon name="chevron" size={16} stroke={2.4} />
        </span>
      </button>

      {/* ── Collapsible body ── */}
      <div className={`gf-gc-collapse${open ? ' is-open' : ''}`}>
        <div>

          {/* Tab strip */}
          {!isGenerating && !isAbandoned && !isAchieved && (
            <div className="gf-gc-tabs">
              <div className="gf-gc-tabind" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
              {(['today', 'sprints', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={e => { e.stopPropagation(); setActiveTab(tab) }}
                  className={`gf-gc-tab${activeTab === tab ? ' is-on' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Tab content */}
          <div
            className="gf-gc-body"
            key={isGenerating ? 'generating' : isAbandoned ? 'abandoned' : isAchieved ? 'achieved' : activeTab}
          >

            {/* ── TODAY TAB ── */}
            {(activeTab === 'today' || isGenerating || isAbandoned || isAchieved) && (
              <div className="gf-tabpane">

                {/* Generating skeleton */}
                {isGenerating && (
                  <div style={{ padding: '14px 16px', background: 'color-mix(in oklab, var(--indigo) 10%, transparent)', borderRadius: 10, border: '1px solid color-mix(in oklab, var(--indigo) 30%, transparent)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'color-mix(in oklab, var(--indigo) 20%, transparent)', border: '1.5px solid color-mix(in oklab, var(--indigo) 50%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, animation: 'pulse 1.5s ease-in-out infinite', color: 'var(--indigo)', flexShrink: 0 }}>✦</div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: 3 }}>Building your plan…</div>
                      <div style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>AI is generating milestones and tasks — this takes a few seconds</div>
                    </div>
                  </div>
                )}

                {/* Recovery Sprint card */}
                {!isGenerating && isRescueMode && !dismissed && !isAbandoned && !isAchieved && (
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2d1f4e', border: '1px solid #5b21b6', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 14 }}>✦ EASY MODE</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>Let&apos;s make today easy.</div>
                    <div style={{ fontSize: 13, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 18 }}>
                      It looks like you&apos;ve been busy. We paused your schedule and set up two quick wins for today — no pressure, no catching up.
                    </div>
                    <Btn variant="primary" style={{ width: '100%', marginBottom: 10 }} onClick={handleStartEasyMode} disabled={mutations.isTriggeringRescue}>
                      {mutations.isTriggeringRescue ? 'Starting easy mode…' : 'Start Easy Mode (2 min)'}
                    </Btn>
                    <button onClick={handleDismiss} style={{ display: 'block', width: '100%', textAlign: 'center', fontSize: 12, color: 'var(--text-mute)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 4, minHeight: 44 }}>
                      I&apos;m feeling good — show my full plan
                    </button>
                  </div>
                )}

                {/* Abandoned banner */}
                {isAbandoned && (
                  <div className="gf-nudge" style={{ '--accent': 'var(--text-mute)', '--accent-soft': 'color-mix(in oklab, var(--text) 5%, transparent)', '--accent-line': 'color-mix(in oklab, var(--text) 10%, transparent)', '--accent-ink': 'var(--text-mute)' } as React.CSSProperties}>
                    <div className="gf-nudge-body">
                      <div className="gf-nudge-kicker">Abandoned</div>
                      <div className="gf-nudge-title">Star faded — goal abandoned.</div>
                    </div>
                    <Btn onClick={() => mutations.changeStatus(goal.id, 'active')} variant="ghost" small>Revive goal</Btn>
                  </div>
                )}

                {/* Achieved banner */}
                {isAchieved && (
                  <div style={{ padding: '11px 14px', background: 'color-mix(in oklab, var(--gold) 10%, transparent)', borderRadius: 9, border: '1px solid color-mix(in oklab, var(--gold) 40%, transparent)' }}>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>🏆 Goal achieved — it lives in your Hall of Fame.</div>
                  </div>
                )}

                {/* Mini progress bar */}
                {!isGenerating && !isRescueMode && !isAbandoned && !isAchieved && todayTasks.length > 0 && (
                  <div className="gf-mini">
                    <div className="gf-mini-track">
                      <div className="gf-mini-fill" style={{ width: `${(completedTodayCount / todayTasks.length) * 100}%` }} />
                    </div>
                    <span className="gf-mini-c">{completedTodayCount}/{todayTasks.length} tasks</span>
                  </div>
                )}

                {/* Daily tasks */}
                {!isGenerating && (!isRescueMode || dismissed) && !isAbandoned && !isAchieved && (todayTasks.length > 0 || activeMilestone || overdueTasks.length > 0) && (
                  <DailyTaskList
                    goalId={goal.id}
                    tasks={todayTasks}
                    overdueTasks={overdueTasks}
                    activeMilestoneId={activeMilestone?.id ?? null}
                    onCompleteTask={mutations.completeTask}
                    onSaveEdit={mutations.saveEdit}
                    onAddTask={mutations.addTask}
                    onRegenerateTask={mutations.regenerateTask}
                    onReorderTasks={mutations.reorderTasks}
                    onRestoreTask={(taskId) => new Promise<void>((resolve, reject) => {
                      restoreTaskMutation.mutate(taskId, { onSuccess: () => resolve(), onError: reject })
                    })}
                  />
                )}

                {/* Status actions */}
                {!isGenerating && !isAbandoned && !isAchieved && (
                  <div className="gf-gc-actions">
                    {allMilestonesComplete ? (
                      <button onClick={() => mutations.changeStatus(goal.id, 'achieved')} className="gf-btn-pill is-sprint">
                        ✦ Ascend to Achieved
                      </button>
                    ) : allSprintTasksDone && activeMilestone ? (
                      <button
                        onClick={async () => { setCompletingMilestone(true); await mutations.completeMilestone(goal.id, activeMilestone.id); setCompletingMilestone(false) }}
                        disabled={completingMilestone}
                        className="gf-btn-pill is-sprint"
                        style={{ opacity: completingMilestone ? 0.6 : 1 }}
                      >
                        {completingMilestone ? '···' : `✦ Complete Sprint → ${nextMilestone ? 'Start ' + nextMilestone.title : 'Final Lap'}`}
                      </button>
                    ) : doneToday ? (
                      <span className="gf-btn-pill" style={{ cursor: 'default', color: 'var(--ring-2)', borderColor: 'color-mix(in oklab, var(--ring-2) 35%, transparent)' }}>
                        ✓ Today&apos;s Work Done
                      </span>
                    ) : (
                      <span className="gf-gc-hint">
                        {todayTasks.length - completedTodayCount} task{todayTasks.length - completedTodayCount === 1 ? '' : 's'} left today
                      </span>
                    )}
                    <button
                      onClick={handleAbandonClick}
                      aria-label={confirmAbandon ? 'Confirm abandon goal' : 'Abandon goal'}
                      className={`gf-btn-pill is-warn${confirmAbandon ? ' is-armed' : ''}`}
                    >
                      {confirmAbandon ? 'Sure? Abandon' : '✕ Abandon'}
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      aria-label={confirmDelete ? 'Confirm delete goal' : 'Delete goal'}
                      className={`gf-btn-pill is-danger${confirmDelete ? ' is-armed' : ''}`}
                    >
                      {confirmDelete ? 'Sure? Delete' : 'Delete'}
                    </button>
                  </div>
                )}

                {/* Abandoned/Achieved terminal actions */}
                {(isAbandoned || isAchieved) && (
                  <div className="gf-gc-actions">
                    {isAbandoned && <Btn onClick={() => mutations.changeStatus(goal.id, 'active')} variant="ghost" small>▶ Revive</Btn>}
                    <button
                      onClick={handleDeleteClick}
                      aria-label={confirmDelete ? 'Confirm delete goal' : 'Delete goal'}
                      className={`gf-btn-pill is-danger${confirmDelete ? ' is-armed' : ''}`}
                    >
                      {confirmDelete ? 'Sure? Delete' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── SPRINTS TAB ── */}
            {activeTab === 'sprints' && !isGenerating && !isAbandoned && !isAchieved && (
              <div className="gf-tabpane">
                {(!isRescueMode || dismissed) && goal.milestones.length > 0 && (
                  <SprintRail
                    milestones={goal.milestones}
                    activeMilestone={activeMilestone}
                    milestonesTotal={goal.milestones_total}
                    failedMilestone={failedMilestone}
                    onRetryGeneration={(milestoneId) => mutations.retrySprintGeneration(goal.id, milestoneId)}
                    isRetrying={mutations.isRetryingSprintGeneration}
                  />
                )}

                {/* Overall progress */}
                <div>
                  <div className="gf-ov-top">
                    <span className="gf-cap2">Overall Progress</span>
                    <span className="gf-ov-pct">{milestonesProgress}%</span>
                  </div>
                  <div className="gf-bar">
                    <div className="gf-bar-fill" style={{ width: `${milestonesProgress}%`, ...(milestonesProgress === 100 ? { background: 'linear-gradient(90deg, var(--gold), #f59e0b)' } : {}) }} />
                  </div>
                  <div className="gf-ov-sub">{goal.milestones_completed} of {goal.milestones_total} sprints completed</div>
                </div>

                {/* Milestones list */}
                <div>
                  <div className="gf-cap2 mb-10">Milestones</div>
                  <div className="gf-ms-list">
                    {goal.milestones.map(m => {
                      const isActive = m.sprint_status === 'active' || m.sprint_status === 'generating'
                      const isFailed = m.sprint_status === 'failed'
                      return (
                        <div key={m.id} className="gf-ms">
                          <span className={`gf-ms-dot${m.is_completed ? ' is-done' : isActive ? ' is-active' : isFailed ? ' is-fail' : ''}`}>
                            {m.is_completed ? '✓' : isFailed ? '✕' : m.position}
                          </span>
                          <span className={`gf-ms-title${m.is_completed ? ' is-done' : isActive ? ' is-active' : ''}`}>{m.title}</span>
                          {m.sprint_status === 'generating' && <span className="gf-ms-tag is-active" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>gen…</span>}
                          {m.sprint_status === 'failed'     && <span className="gf-ms-tag is-fail">failed</span>}
                          {m.sprint_status === 'ready'      && <span className="gf-ms-tag is-active">ready</span>}
                          {m.is_completed                   && <span className="gf-ms-tag is-done">done</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && !isGenerating && (
              <HistoryTabContent goal={goal} b={b} />
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
