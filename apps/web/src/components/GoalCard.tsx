import { useState, useRef, useEffect, useId } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { T } from '../lib/theme'
import { todayStr, streak, starBrightness, lastStreakLength } from '../lib/gamification'
import Badge from './ui/Badge'
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
    <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <motion.div
        animate={{ scale: [0.88, 1.2, 0.88], opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(251,191,36,${0.1 + n * 0.28}) 30%, transparent 75%)`,
        }}
      />
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
  const totalWeeks = 8
  const totalDays = totalWeeks * 7
  // Start from Monday 8 weeks ago
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - (totalDays - 1))
  const dayOfWeek = (startDate.getDay() + 6) % 7 // 0=Mon
  startDate.setDate(startDate.getDate() - dayOfWeek)

  const cells: (boolean | null)[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    cells.push(d > today ? null : doneSet.has(iso))
  }

  const weeks: (boolean | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 22 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ height: 11, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, width: 8 }}>{d}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, flex: 1, overflow: 'hidden' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            {wi % 2 === 0 ? (
              <span style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, height: 18, display: 'flex', alignItems: 'flex-end', paddingBottom: 3 }}>W{wi + 1}</span>
            ) : (
              <div style={{ height: 18 }} />
            )}
            {week.map((done, di) => (
              <div key={di} style={{
                height: 11, borderRadius: 2,
                background: done === null ? 'transparent' : done ? T.orange : T.dim,
                opacity: done === null ? 0 : 1,
              }} />
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

  // Build streaks
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
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Star brightness */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, textTransform: 'uppercase' }}>Star Brightness</span>
          <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono }}>{Math.round(b * 100)}%</span>
        </div>
        <div style={{ height: 4, background: T.dim, borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${b * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#f97316,#fbbf24)' }}
          />
        </div>
        <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>
          {b < 0.3 ? 'Almost out — complete tasks to recharge' : b < 0.6 ? 'Fading — keep going' : 'Burning bright'}
        </div>
      </div>

      {/* Completion history with toggle */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, textTransform: 'uppercase' }}>Completion History</span>
            <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginLeft: 8 }}>{goal.completed_days.length} days</span>
          </div>
          <div style={{ display: 'flex', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5, padding: 2, gap: 1 }}>
            {(['calendar', 'streaks'] as HistoryView[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                position: 'relative', padding: '0 7px', height: 18, borderRadius: 3, fontSize: 9,
                fontFamily: T.mono, cursor: 'pointer', border: 'none', background: 'transparent',
                color: view === v ? T.text : T.dim, transition: 'color 0.15s', letterSpacing: '0.3px',
              }}>
                {view === v && (
                  <motion.div
                    layoutId={`hist-toggle-${goal.id}`}
                    style={{ position: 'absolute', inset: 0, borderRadius: 3, background: T.dim }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{v === 'calendar' ? '≡ weeks' : '▌streaks'}</span>
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {view === 'calendar'
              ? <WeekCalendar completedDays={goal.completed_days} />
              : <StreakBars completedDays={goal.completed_days} />
            }
          </motion.div>
        </AnimatePresence>
      </div>

      {/* About this goal */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
        <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, textTransform: 'uppercase', marginBottom: 8 }}>About this goal</div>
        <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.65, fontFamily: T.mono, marginBottom: 8 }}>{goal.smart_description}</p>
        <p style={{ fontSize: 11, color: T.dim, lineHeight: 1.55, fontFamily: T.mono }}>"{goal.raw_input}"</p>
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
    return Date.now() - Number(ts) < 8 * 60 * 60 * 1000  // safe: runs in initializer, not render
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

  return (
    <motion.div
      className={`goal-card-shell ${isAchieved ? 'goal-achieved' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: isAbandoned ? 0.5 : 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        background: T.card, borderRadius: 14, overflow: 'hidden', marginBottom: 1,
        border: `1px solid ${isAbandoned ? T.dim + '40' : open ? T.borderHi : T.border}`,
        boxShadow: isAbandoned ? 'none'
          : completionRatio > 0
          ? `0 0 ${Math.round(8 + completionRatio * 12)}px rgba(16,185,129,${Math.max(0.08, 0.04 + completionRatio * 0.1).toFixed(2)})`
          : '0 0 18px rgba(16,185,129,0.07)',
      }}
    >

      {/* ── Header row (click to expand) ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${goal.smart_title} — click to ${open ? 'collapse' : 'expand'}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
        style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start' }}
      >
        <PuffyStar brightness={b} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {!isGenerating && <Badge color={T.indigo}>{goal.goal_type}</Badge>}
            {isGenerating && <Badge color={T.muted}>generating…</Badge>}
            {isAbandoned  && <Badge color={T.muted}>abandoned</Badge>}
            {isAchieved   && <Badge color={T.amber}>✦ achieved</Badge>}
            {doneToday && !isAbandoned && !isAchieved && <Badge color={T.emerald}>✓ done today</Badge>}
            {s > 0 && !isAbandoned && <Badge color={T.amber}>{s}d streak</Badge>}
            {s === 0 && lastStreak >= 2 && !isAbandoned && !isAchieved && <Badge color={T.dim}>last streak: {lastStreak}d</Badge>}
            {goal.target_date && <Badge color={days < 0 ? T.rose : T.muted}>{dl}</Badge>}
          </div>
          <div style={{ fontSize: 15, color: isAbandoned ? T.muted : T.text, fontFamily: T.serif, lineHeight: 1.45 }}>
            {goal.smart_title}
          </div>
        </div>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: T.dim, fontSize: 15, flexShrink: 0, display: 'block' }}
        >▾</motion.span>
      </div>

      {/* ── Expandable body ── */}
      <AnimatePresence initial={false}>
      {open && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ overflow: 'hidden' }}
      >

      {/* ── Tab strip ── */}
      {!isGenerating && !isAbandoned && !isAchieved && (
        <div style={{ display: 'flex', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          {(['today', 'sprints', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={e => { e.stopPropagation(); setActiveTab(tab) }}
              style={{
                position: 'relative', flex: 1, height: 36,
                fontSize: 11, letterSpacing: '0.5px', textTransform: 'capitalize',
                fontFamily: T.mono, cursor: 'pointer',
                background: 'none', border: 'none',
                color: activeTab === tab ? T.text : T.muted,
                transition: 'color 0.2s',
              }}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId={`card-tab-${goal.id}`}
                  style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 1.5, background: T.orange, borderRadius: 99 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab content with animated transitions ── */}
      <AnimatePresence mode="wait">
      <motion.div
        key={isGenerating ? 'generating' : isAbandoned ? 'abandoned' : isAchieved ? 'achieved' : activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
      >

      {/* ── TODAY TAB ── */}
      {(activeTab === 'today' || isGenerating || isAbandoned || isAchieved) && (
        <div>
          {/* Generating skeleton */}
          {isGenerating && (
            <div style={{ padding: '0 18px 18px' }}>
              <div style={{
                padding: '14px 16px', background: `${T.indigo}10`,
                borderRadius: 10, border: `1px solid ${T.indigo}30`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `${T.indigo}20`, border: `1.5px solid ${T.indigo}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, animation: 'pulse 1.5s ease-in-out infinite',
                  color: T.indigo, flexShrink: 0,
                }}>✦</div>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontFamily: T.serif, marginBottom: 3 }}>Building your plan…</div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>AI is generating milestones and tasks — this takes a few seconds</div>
                </div>
              </div>
            </div>
          )}

          {/* Recovery Sprint card */}
          {!isGenerating && isRescueMode && !dismissed && !isAbandoned && !isAchieved && (
            <div style={{ padding: '0 18px 22px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#2d1f4e', border: '1px solid #5b21b6',
                borderRadius: 20, padding: '3px 10px',
                fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                color: T.amber, fontFamily: T.mono, textTransform: 'uppercase', marginBottom: 14,
              }}>✦ EASY MODE</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6, lineHeight: 1.3 }}>Let's make today easy.</div>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 18 }}>
                It looks like you've been busy. We paused your schedule and set up two quick wins for today — no pressure, no catching up.
              </div>
              <Btn variant="primary" style={{ width: '100%', marginBottom: 10 }} onClick={handleStartEasyMode} disabled={mutations.isTriggeringRescue}>
                {mutations.isTriggeringRescue ? 'Starting easy mode…' : 'Start Easy Mode (2 min)'}
              </Btn>
              <button onClick={handleDismiss} style={{ display: 'block', width: '100%', textAlign: 'center', fontSize: 12, color: T.muted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 4, minHeight: 44 }}>
                I'm feeling good — show my full plan
              </button>
            </div>
          )}

          {/* Abandoned banner */}
          {isAbandoned && (
            <div style={{ margin: '0 18px 14px', padding: '11px 14px', background: T.dim + '25', borderRadius: 9, border: `1px solid ${T.dim}40` }}>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, marginBottom: 8 }}>✦ Star faded — goal abandoned.</div>
              <Btn onClick={() => mutations.changeStatus(goal.id, 'active')} variant="ghost" small>Revive goal</Btn>
            </div>
          )}

          {/* Achieved banner */}
          {isAchieved && (
            <div style={{ margin: '0 18px 14px', padding: '11px 14px', background: T.amber + '10', borderRadius: 9, border: `1px solid ${T.amber}40` }}>
              <div style={{ fontSize: 12, color: T.amber, fontFamily: T.mono }}>🏆 Goal achieved — it lives in your Hall of Fame.</div>
            </div>
          )}

          {/* Mini progress bar */}
          {!isGenerating && !isRescueMode && !isAbandoned && !isAchieved && todayTasks.length > 0 && (
            <div style={{ padding: '10px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 3, background: T.dim, borderRadius: 99, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedTodayCount / todayTasks.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{ height: '100%', background: T.emerald, borderRadius: 99 }}
                />
              </div>
              <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, flexShrink: 0 }}>
                {completedTodayCount}/{todayTasks.length} tasks
              </span>
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
            <div style={{ padding: '0 18px 14px', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              {allMilestonesComplete ? (
                <button onClick={() => mutations.changeStatus(goal.id, 'achieved')} style={{ cursor: 'pointer', padding: '5px 14px', borderRadius: 8, fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', background: `${T.amber}20`, color: T.amber, border: `1px solid ${T.amber}60`, boxShadow: `0 0 14px ${T.amber}50` }}>
                  ✦ Ascend to Achieved
                </button>
              ) : allSprintTasksDone && activeMilestone ? (
                <button
                  onClick={async () => { setCompletingMilestone(true); await mutations.completeMilestone(goal.id, activeMilestone.id); setCompletingMilestone(false) }}
                  disabled={completingMilestone}
                  style={{ cursor: completingMilestone ? 'default' : 'pointer', padding: '5px 14px', borderRadius: 8, fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', background: `${T.indigo}20`, color: T.indigo, border: `1px solid ${T.indigo}55`, boxShadow: `0 0 12px ${T.indigo}35`, opacity: completingMilestone ? 0.6 : 1 }}
                >
                  {completingMilestone ? '···' : `✦ Complete Sprint → ${nextMilestone ? 'Start ' + nextMilestone.title : 'Final Lap'}`}
                </button>
              ) : doneToday ? (
                <span style={{ padding: '5px 12px', borderRadius: 8, fontFamily: T.mono, fontSize: 11, background: `${T.emerald}15`, color: T.emerald, border: `1px solid ${T.emerald}40`, letterSpacing: '0.04em' }}>✓ Today's Work Done</span>
              ) : null}
              <button onClick={handleAbandonClick} aria-label={confirmAbandon ? 'Confirm abandon goal' : 'Abandon goal'} style={{ cursor: 'pointer', minHeight: 44, minWidth: 44, padding: '9px 14px', borderRadius: 8, fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', background: confirmAbandon ? `${T.amber}15` : 'transparent', color: confirmAbandon ? T.amber : T.muted, border: confirmAbandon ? `1px solid ${T.amber}60` : `1px solid ${T.border}`, transition: 'background 0.15s, border-color 0.15s, color 0.15s' }}>
                {confirmAbandon ? 'Sure? Abandon' : '✕ Abandon'}
              </button>
              <button onClick={handleDeleteClick} aria-label={confirmDelete ? 'Confirm delete goal' : 'Delete goal'} style={{ cursor: 'pointer', minHeight: 44, minWidth: 44, padding: '9px 14px', borderRadius: 8, fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', background: confirmDelete ? `${T.rose}25` : 'transparent', color: T.rose, border: confirmDelete ? `1px solid ${T.rose}80` : `1px solid ${T.rose}40`, transition: 'background 0.15s, border-color 0.15s' }}>
                {confirmDelete ? 'Sure? Delete' : 'Delete'}
              </button>
            </div>
          )}
          {(isAbandoned || isAchieved) && (
            <div style={{ padding: '0 18px 14px', display: 'flex', gap: 7 }}>
              {isAbandoned && <Btn onClick={() => mutations.changeStatus(goal.id, 'active')} variant="ghost" small>▶ Revive</Btn>}
              <button onClick={handleDeleteClick} aria-label={confirmDelete ? 'Confirm delete goal' : 'Delete goal'} style={{ cursor: 'pointer', minHeight: 44, minWidth: 44, padding: '9px 14px', borderRadius: 8, fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', background: confirmDelete ? `${T.rose}25` : 'transparent', color: T.rose, border: confirmDelete ? `1px solid ${T.rose}80` : `1px solid ${T.rose}40`, transition: 'background 0.15s, border-color 0.15s' }}>
                {confirmDelete ? 'Sure? Delete' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SPRINTS TAB ── */}
      {activeTab === 'sprints' && !isGenerating && !isAbandoned && !isAchieved && (
        <div>
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
          <div style={{ padding: '0 18px 18px' }}>
            {/* Overall progress — above milestones */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, textTransform: 'uppercase' }}>Overall Progress</span>
                <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono }}>{milestonesProgress}%</span>
              </div>
              <div style={{ height: 4, background: T.dim, borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${milestonesProgress}%` }}
                  transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{ height: '100%', borderRadius: 2, background: milestonesProgress === 100 ? T.amber : T.indigo }}
                />
              </div>
              <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 5 }}>{goal.milestones_completed} of {goal.milestones_total} sprints completed</div>
            </div>
            {/* Milestones */}
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 9 }}>MILESTONES</div>
            {goal.milestones.map(m => {
              const isActive = m.sprint_status === 'active' || m.sprint_status === 'generating'
              const isFailed = m.sprint_status === 'failed'
              return (
                <div key={m.id} style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 7 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontFamily: T.mono, background: m.is_completed ? `${T.emerald}20` : isActive ? `${T.indigo}25` : isFailed ? `${T.rose}20` : `${T.dim}15`, border: m.is_completed ? `1.5px solid ${T.emerald}60` : isActive ? `1.5px solid ${T.indigo}70` : isFailed ? `1.5px solid ${T.rose}60` : `1.5px solid ${T.dim}`, color: m.is_completed ? T.emerald : isActive ? T.indigo : isFailed ? T.rose : T.muted }}>
                    {m.is_completed ? '✓' : isFailed ? '✕' : m.position}
                  </div>
                  <span style={{ fontSize: 12, flex: 1, textDecoration: m.is_completed ? 'line-through' : 'none', color: m.is_completed ? T.dim : isActive ? T.text : isFailed ? T.rose : T.muted, opacity: m.is_completed ? 0.5 : 1, fontFamily: T.mono }}>{m.title}</span>
                  {m.sprint_status === 'generating' && <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, animation: 'pulse 1.5s ease-in-out infinite' }}>generating···</span>}
                  {m.sprint_status === 'failed' && <span style={{ fontSize: 10, color: T.rose, fontFamily: T.mono }}>failed</span>}
                  {m.sprint_status === 'ready' && <span style={{ fontSize: 10, color: T.indigo, fontFamily: T.mono }}>ready</span>}
                  {m.is_completed && <span style={{ fontSize: 10, color: T.emerald, fontFamily: T.mono }}>done</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && !isGenerating && (
        <div>
          <HistoryTabContent goal={goal} b={b} />
        </div>
      )}

      </motion.div>
      </AnimatePresence>

      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  )
}
