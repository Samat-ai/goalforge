import { useState, useEffect } from 'react'
import { useUser } from '@clerk/react'
import { T } from '../lib/theme'
import AppHeader from '../components/AppHeader'
import { Creature } from '../components/GamificationSvgs'
import TodayBar from '../components/TodayBar'
import AddGoal from '../components/AddGoal'
import GoalCard from '../components/GoalCard'
import FocusOverlay from '../components/FocusOverlay'
import RewardModal from '../components/RewardModal'
import CollectionModal from '../components/CollectionModal'
import EnergyModal from '../components/EnergyModal'
import StarShop from '../components/StarShop'
import QuickCaptureModal from '../components/QuickCaptureModal'
import { useBadgesQuery, useGoalsQuery, useProfileQuery, useGoalMutations, useShopRewardsQuery, useShopRewardMutations } from '../hooks'
import { useRewardsQuery, useEquipRewardMutation } from '../hooks/useRewards'
import { useEnergyResizeMutation } from '../hooks/useEnergyMutations'
import { dayDiff, todayStr } from '../lib/gamification'
import type { Goal, RewardDrop } from '../lib/types'

// ── WelcomeBackCard (returning-user nudge) ────────────────────────────────────

const WELCOME_DISMISS_KEY = 'welcome_back_dismissed_at'
const WELCOME_DISMISS_TTL = 24 * 60 * 60 * 1000 // 24 hours
const PINNED_GOALS_KEY = 'dashboard_pinned_goals'

type SortMode = 'priority' | 'progress' | 'newest'
type TaskScope = 'any' | 'today' | 'overdue'

function computeWelcomeBack(goals: Goal[], today: string): { daysAway: number; lastCompletedDate: string } | null {
  const allCompletedDays = goals.flatMap(g => g.completed_days).filter(d => d <= today)
  if (allCompletedDays.length === 0) return null

  const lastCompletedDate = allCompletedDays.reduce((latest, cur) => (cur > latest ? cur : latest))
  const daysAway = dayDiff(lastCompletedDate, today)
  if (daysAway < 3) return null

  return { daysAway, lastCompletedDate }
}

function WelcomeBackCard({ goals, onFocus }: { goals: Goal[]; onFocus: () => void }) {
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem(WELCOME_DISMISS_KEY)
    return !!ts && Date.now() - Number(ts) < WELCOME_DISMISS_TTL
  })

  const today = todayStr()
  const state = computeWelcomeBack(goals, today)

  if (!state || dismissed) return null

  function dismiss() {
    localStorage.setItem(WELCOME_DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  return (
    <div className="animate-slide-up" style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '14px 18px', borderRadius: 12, marginBottom: 16,
      background: `${T.indigo}12`, border: `1px solid ${T.indigo}40`,
      borderLeft: `3px solid ${T.indigo}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.indigo, letterSpacing: '0.06em', marginBottom: 3 }}>
          WELCOME BACK
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 14, color: T.text }}>
          You were away for {state.daysAway} days. No reset needed.
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginTop: 2 }}>
          Last completion: {state.lastCompletedDate}. One tiny win gets momentum back.
        </div>
      </div>
      <button
        onClick={onFocus}
        style={{
          minHeight: 44, minWidth: 44, padding: '9px 18px', borderRadius: 8,
          cursor: 'pointer', flexShrink: 0,
          fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
          background: `${T.indigo}18`, color: T.indigo, border: `1px solid ${T.indigo}45`,
        }}
      >
        Enter Focus Mode
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          minHeight: 44, minWidth: 44, padding: '9px 12px', borderRadius: 8,
          cursor: 'pointer', flexShrink: 0,
          fontFamily: T.mono, fontSize: 11, color: T.dim,
          background: 'transparent', border: 'none',
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ── DoThisNow (blocker resolution CTA) ───────────────────────────────────────

type Blocker =
  | { kind: 'overdue'; count: number; goalId: string }
  | { kind: 'sprint_complete'; goalId: string; milestoneId: string; goalTitle: string; milestoneTitle: string }

function computeBlocker(goals: Goal[], today: string): Blocker | null {
  // P1: Overdue incomplete tasks across all active goals
  let overdueCount = 0
  let firstOverdueGoalId: string | null = null
  for (const goal of goals) {
    if (goal.status !== 'active') continue
    const overdue = goal.daily_tasks.filter(t => !t.is_completed && t.assigned_date < today)
    if (overdue.length > 0) {
      overdueCount += overdue.length
      if (!firstOverdueGoalId) firstOverdueGoalId = goal.id
    }
  }
  if (overdueCount > 0 && firstOverdueGoalId) {
    return { kind: 'overdue', count: overdueCount, goalId: firstOverdueGoalId }
  }

  // P2: Active milestone with all tasks completed but not yet marked complete
  for (const goal of goals) {
    if (goal.status !== 'active') continue
    const activeMilestone = goal.milestones.find(m => m.sprint_status === 'active' && !m.is_completed)
    if (!activeMilestone) continue
    const milestoneTasks = goal.daily_tasks.filter(t => t.milestone_id === activeMilestone.id)
    if (milestoneTasks.length > 0 && milestoneTasks.every(t => t.is_completed)) {
      return {
        kind: 'sprint_complete',
        goalId: goal.id,
        milestoneId: activeMilestone.id,
        goalTitle: goal.smart_title,
        milestoneTitle: activeMilestone.title,
      }
    }
  }

  return null
}

interface DoThisNowProps {
  goals: Goal[]
}

function DoThisNow({ goals }: DoThisNowProps) {
  const [completing, setCompleting] = useState(false)
  const userId = goals[0]?.user_id ?? ''
  const { completeMilestone } = useGoalMutations(userId)
  const today = todayStr()
  const blocker = computeBlocker(goals, today)

  if (!blocker) return null

  const isOverdue = blocker.kind === 'overdue'
  const color = isOverdue ? T.amber : T.emerald

  function handleAction() {
    if (!blocker) return
    if (blocker.kind === 'overdue') {
      document.getElementById(`goal-card-${blocker.goalId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (blocker.kind === 'sprint_complete' && !completing) {
      setCompleting(true)
      completeMilestone(blocker.goalId, blocker.milestoneId).finally(() => setCompleting(false))
    }
  }

  const label = isOverdue
    ? `${blocker.count} overdue task${blocker.count === 1 ? '' : 's'} need your attention`
    : 'Sprint complete — unlock your next tasks'
  const sub = blocker.kind === 'overdue'
    ? 'Catch up to keep your streak alive'
    : `"${blocker.milestoneTitle}" is done. Advance to the next sprint.`
  const btnLabel = isOverdue ? 'Catch Up ↓' : completing ? 'Unlocking…' : 'Complete Sprint ✦'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '14px 18px', borderRadius: 12, marginBottom: 18,
      background: `${color}10`, border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
      animation: 'fadeUp 0.35s ease both',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color, letterSpacing: '0.06em', marginBottom: 3 }}>
          DO THIS NOW
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 14, color: T.text }}>{label}</div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginTop: 2 }}>{sub}</div>
      </div>
      <button
        onClick={handleAction}
        disabled={completing}
        style={{
          minHeight: 44, minWidth: 44, padding: '9px 18px', borderRadius: 8,
          cursor: completing ? 'wait' : 'pointer', flexShrink: 0,
          fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
          background: `${color}18`, color, border: `1px solid ${color}45`,
          opacity: completing ? 0.6 : 1, transition: 'opacity 0.15s',
        }}
      >
        {btnLabel}
      </button>
    </div>
  )
}

// ── EmptyState (onboarding for new users) ─────────────────────────────────────
const EXAMPLE_GOALS = [
  'I want to learn Spanish basics in 3 months',
  'Get in shape — lose 10 lbs by summer',
  'Read 12 books this year',
]

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', padding: '40px 16px 32px',
      animation: 'fadeUp 0.5s ease both',
    }}>
      <div style={{ marginBottom: 20, opacity: 0.85 }}>
        <Creature pts={0} size={96} />
      </div>
      <h2 style={{
        fontFamily: T.serif, fontSize: 22, fontWeight: 600,
        color: T.text, marginBottom: 10, lineHeight: 1.3,
      }}>
        Your journey starts here ✦
      </h2>
      <p style={{
        fontSize: 13, color: T.textDim, fontFamily: T.mono,
        maxWidth: 380, lineHeight: 1.7, marginBottom: 28,
      }}>
        Describe any goal in plain language. Our AI will turn it into a
        step-by-step plan with daily tasks.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 480 }}>
        {EXAMPLE_GOALS.map(text => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            style={{
              minHeight: 44, padding: '10px 16px', borderRadius: 22,
              fontFamily: T.mono, fontSize: 12, cursor: 'pointer',
              background: `${T.indigo}12`, color: T.indigo,
              border: `1px solid ${T.indigo}35`,
              transition: 'background 0.15s, border-color 0.15s',
              lineHeight: 1.4, textAlign: 'left',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${T.indigo}22`
              e.currentTarget.style.borderColor = `${T.indigo}60`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `${T.indigo}12`
              e.currentTarget.style.borderColor = `${T.indigo}35`
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function MomentumCoachCard({
  goals,
  onQuickCapture,
  onFocus,
}: {
  goals: Goal[]
  onQuickCapture: () => void
  onFocus: () => void
}) {
  if (goals.length === 0) return null

  const today = todayStr()
  const active = goals.filter(g => g.status === 'active')
  const recentTasks = active.flatMap(g =>
    g.daily_tasks.filter(t => t.assigned_date <= today && dayDiff(t.assigned_date, today) < 7),
  )
  const completedRecent = recentTasks.filter(t => t.is_completed).length
  const overdue = active.flatMap(g => g.daily_tasks.filter(t => !t.is_completed && t.assigned_date < today)).length
  const completionRate = recentTasks.length > 0 ? completedRecent / recentTasks.length : 0

  let title = 'Momentum Coach'
  let body = 'Capture one tiny action and finish it before checking anything else.'
  if (recentTasks.length === 0) {
    title = 'Start Your Engine'
    body = 'No tasks logged in the last 7 days. Add one tiny task and claim an easy win.'
  } else if (completionRate >= 0.8 && overdue === 0) {
    title = 'You Are In The Zone'
    body = 'Great consistency this week. Add one stretch task while momentum is high.'
  } else if (completionRate >= 0.5) {
    title = 'Solid Base, One Bottleneck'
    body = 'Clear one overdue task first, then move to today\'s highest-impact task.'
  }

  return (
    <section style={{
      marginBottom: 16,
      borderRadius: 12,
      border: `1px solid ${T.border}`,
      background: T.card,
      padding: '12px 14px',
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.1em', marginBottom: 8 }}>
        COMPETITOR MODE: COACH LOOP
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 17, color: T.text, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 10 }}>
        {body}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={onQuickCapture}
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 14px',
            borderRadius: 8,
            border: `1px solid ${T.indigo}45`,
            background: `${T.indigo}18`,
            color: T.indigo,
            cursor: 'pointer',
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: '0.05em',
          }}
        >
          Quick Capture
        </button>
        <button
          onClick={onFocus}
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 14px',
            borderRadius: 8,
            border: `1px solid ${T.orange}45`,
            background: `${T.orange}16`,
            color: T.orange,
            cursor: 'pointer',
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: '0.05em',
          }}
        >
          Start Focus
        </button>
      </div>
    </section>
  )
}

// ── Dashboard (main page) ─────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useUser()
  const userId = user?.id

  const { goals, isLoading: loading, isError, refetch } = useGoalsQuery(userId)
  const { pts } = useProfileQuery(userId)
  const { badges } = useBadgesQuery(userId)

  const [filter, setFilter] = useState<string>('all')
  const [goalSearch, setGoalSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('priority')
  const [taskScope, setTaskScope] = useState<TaskScope>('any')
  const [pinnedGoalIds, setPinnedGoalIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PINNED_GOALS_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((value): value is string => typeof value === 'string')
    } catch {
      return []
    }
  })
  const [planCopied, setPlanCopied] = useState(false)
  const [addGoalText, setAddGoalText] = useState('')
  const [focusOpen, setFocusOpen] = useState(false)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
  const [activeRewardDrop, setActiveRewardDrop] = useState<RewardDrop | null>(null)
  const [showCollection, setShowCollection] = useState(false)
  const [showEnergyModal, setShowEnergyModal] = useState(() => {
    const triggered = sessionStorage.getItem('energy') === 'low'
    if (triggered) sessionStorage.removeItem('energy')
    return triggered
  })

  const { data: rewards = [] } = useRewardsQuery(userId ?? '')
  const { rewards: shopRewards } = useShopRewardsQuery(userId)
  const shopMutations = useShopRewardMutations(userId ?? '')
  const equipMutation = useEquipRewardMutation(userId ?? '')
  const mutations = useGoalMutations(userId ?? '', (drop) => setActiveRewardDrop(drop))
  const energyResizeMutation = useEnergyResizeMutation(userId ?? '')

  useEffect(() => { document.title = 'Dashboard — GoalForge' }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickCaptureOpen(true)
      }
      if (e.key === 'Escape') {
        setQuickCaptureOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const error = isError ? 'Failed to load goals.' : null
  const today = todayStr()

  const dailyPlanItems = goals
    .filter(goal => goal.status === 'active')
    .flatMap(goal =>
      goal.daily_tasks
        .filter(task => !task.is_completed && task.assigned_date <= today)
        .map(task => ({
          id: task.id,
          goalTitle: goal.smart_title,
          description: task.description,
          assignedDate: task.assigned_date,
        })),
    )
    .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate))
    .slice(0, 3)

  const normalizedSearch = goalSearch.trim().toLowerCase()
  const searched = goals.filter(goal => {
    if (!normalizedSearch) return true
    const inGoal = `${goal.smart_title} ${goal.smart_description}`.toLowerCase().includes(normalizedSearch)
    if (inGoal) return true
    return goal.daily_tasks.some(task => task.description.toLowerCase().includes(normalizedSearch))
  })

  const byStatus = filter === 'all' ? searched : searched.filter(g => g.status === filter)
  const byScope = byStatus.filter(goal => {
    if (taskScope === 'any') return true
    if (taskScope === 'today') {
      return goal.daily_tasks.some(task => !task.is_completed && task.assigned_date === today)
    }
    return goal.daily_tasks.some(task => !task.is_completed && task.assigned_date < today)
  })

  const sortedGoals = [...byScope].sort((a, b) => {
    const aPinned = pinnedGoalIds.includes(a.id)
    const bPinned = pinnedGoalIds.includes(b.id)
    if (aPinned !== bPinned) return aPinned ? -1 : 1

    if (sortMode === 'progress') {
      return b.progress - a.progress
    }

    if (sortMode === 'newest') {
      return b.created_at.localeCompare(a.created_at)
    }

    const aOverdue = a.daily_tasks.filter(t => !t.is_completed && t.assigned_date < today).length
    const bOverdue = b.daily_tasks.filter(t => !t.is_completed && t.assigned_date < today).length
    if (aOverdue !== bOverdue) return bOverdue - aOverdue

    const aToday = a.daily_tasks.filter(t => !t.is_completed && t.assigned_date === today).length
    const bToday = b.daily_tasks.filter(t => !t.is_completed && t.assigned_date === today).length
    return bToday - aToday
  })

  function togglePinGoal(goalId: string) {
    setPinnedGoalIds(prev => {
      const next = prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
      localStorage.setItem(PINNED_GOALS_KEY, JSON.stringify(next))
      return next
    })
  }

  async function copyDailyPlan() {
    if (dailyPlanItems.length === 0) return
    const payload = dailyPlanItems
      .map((item, idx) => `${idx + 1}. [${item.goalTitle}] ${item.description}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(payload)
      setPlanCopied(true)
      setTimeout(() => setPlanCopied(false), 1500)
    } catch {
      setPlanCopied(false)
    }
  }

  // ── Render ──
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.mono }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.dim}; border-radius: 2px; }
        textarea:focus { border-color: ${T.orange} !important; outline: none; }
        button:hover { opacity: 0.82; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        .filter-tabs::-webkit-scrollbar { display: none; }
        button:focus-visible, a:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; border-radius: 4px; }
      `}</style>

      <AppHeader pts={pts} onOpenCollection={() => setShowCollection(true)} />

      <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto' }} className="px-4 py-5 sm:px-8 sm:py-7">

        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 400, color: T.text, marginBottom: 3 }} className="text-[26px] sm:text-[32px] lg:text-[38px]">
            Your Goals
          </h1>
          <p style={{ fontSize: 12, color: T.muted }}>
            {goals.filter(g => g.status === 'active').length} active · {goals.length} total
          </p>
          <button
            onClick={() => setQuickCaptureOpen(true)}
            style={{
              marginTop: 10,
              minHeight: 44,
              minWidth: 44,
              padding: '0 14px',
              borderRadius: 8,
              border: `1px solid ${T.indigo}42`,
              background: `${T.indigo}12`,
              color: T.indigo,
              cursor: 'pointer',
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: '0.05em',
            }}
          >
            Quick Capture (Ctrl/Cmd+K)
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div role="status" aria-label="Loading goals" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `2px solid ${T.dim}`, borderTop: `2px solid ${T.orange}`,
              animation: 'spin 0.75s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            padding: '20px 22px', background: `${T.rose}10`, border: `1px solid ${T.rose}30`,
            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
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
              }}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <WelcomeBackCard goals={goals} onFocus={() => setFocusOpen(true)} />
            <DoThisNow goals={goals} />
            <TodayBar goals={goals} onFocusOpen={() => setFocusOpen(true)} onEnergyOpen={() => setShowEnergyModal(true)} />
            <section style={{
              marginBottom: 14,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.card,
              padding: '12px 14px',
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.1em', marginBottom: 8 }}>
                COMMAND DECK
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  value={goalSearch}
                  onChange={e => setGoalSearch(e.target.value)}
                  placeholder="Search goals or task text"
                  style={{
                    width: '100%',
                    minHeight: 44,
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    color: T.text,
                    padding: '0 12px',
                    fontFamily: T.mono,
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={sortMode}
                    onChange={e => setSortMode(e.target.value as SortMode)}
                    style={{
                      minHeight: 44,
                      minWidth: 170,
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.surface,
                      color: T.text,
                      padding: '0 10px',
                      fontFamily: T.mono,
                      fontSize: 12,
                    }}
                  >
                    <option value="priority">Sort: Priority</option>
                    <option value="progress">Sort: Progress</option>
                    <option value="newest">Sort: Newest</option>
                  </select>
                  {(['any', 'today', 'overdue'] as const).map(scope => (
                    <button
                      key={scope}
                      onClick={() => setTaskScope(scope)}
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: `1px solid ${taskScope === scope ? T.indigo : T.border}`,
                        background: taskScope === scope ? `${T.indigo}20` : T.surface,
                        color: taskScope === scope ? T.indigo : T.textDim,
                        cursor: 'pointer',
                        fontFamily: T.mono,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section style={{
              marginBottom: 14,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.card,
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.1em' }}>
                  TODAY'S TOP 3
                </div>
                <button
                  onClick={() => void copyDailyPlan()}
                  disabled={dailyPlanItems.length === 0}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${T.emerald}50`,
                    background: `${T.emerald}15`,
                    color: T.emerald,
                    cursor: dailyPlanItems.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: dailyPlanItems.length === 0 ? 0.5 : 1,
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: '0.05em',
                  }}
                >
                  {planCopied ? 'Copied' : 'Copy Plan'}
                </button>
              </div>
              {dailyPlanItems.length === 0 ? (
                <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>No pending tasks due today.</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {dailyPlanItems.map((item, idx) => (
                    <div key={item.id} style={{
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.surface,
                      padding: '8px 10px',
                    }}>
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 2 }}>
                        #{idx + 1} · {item.goalTitle}
                      </div>
                      <div style={{ fontFamily: T.serif, fontSize: 14, color: T.text }}>
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <MomentumCoachCard
              goals={goals}
              onQuickCapture={() => setQuickCaptureOpen(true)}
              onFocus={() => setFocusOpen(true)}
            />
            <AddGoal onAdd={mutations.addGoal} value={addGoalText} onChange={setAddGoalText} />

            <StarShop
              pts={pts}
              rewards={shopRewards}
              onAdd={shopMutations.addReward}
              onRedeem={shopMutations.redeemReward}
              isCreating={shopMutations.isCreating}
              isRedeeming={shopMutations.isRedeeming}
            />

            {badges.length > 0 && (
              <section style={{
                marginBottom: 14,
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.card,
                padding: '12px 14px',
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
              </section>
            )}

            {goals.length === 0 ? (
              <EmptyState onSelect={setAddGoalText} />
            ) : (
              <>
                {/* Filter tabs */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 18, overflowX: 'auto', scrollbarWidth: 'none' }} className="filter-tabs">
                  {(['all', 'active', 'achieved', 'abandoned'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '7px 14px', fontFamily: T.mono, fontSize: 11,
                        letterSpacing: '0.06em', flexShrink: 0,
                        color: filter === f ? T.text : T.muted,
                        borderBottom: filter === f ? `2px solid ${T.orange}` : '2px solid transparent',
                      }}
                    >
                      {f} ({goals.filter(g => f === 'all' ? true : g.status === f).length})
                    </button>
                  ))}
                </div>

                {/* Goal list */}
                <div aria-live="polite" aria-label="Goal list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sortedGoals.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '44px 0', color: T.muted, fontSize: 13 }}>
                      No goals match this view.
                    </div>
                  )}
                  {sortedGoals.map(goal => (
                    <div key={goal.id} id={`goal-card-${goal.id}`}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                        <button
                          onClick={() => togglePinGoal(goal.id)}
                          style={{
                            minHeight: 44,
                            minWidth: 44,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: `1px solid ${pinnedGoalIds.includes(goal.id) ? T.amber : T.border}`,
                            background: pinnedGoalIds.includes(goal.id) ? `${T.amber}16` : T.surface,
                            color: pinnedGoalIds.includes(goal.id) ? T.amber : T.textDim,
                            cursor: 'pointer',
                            fontFamily: T.mono,
                            fontSize: 11,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {pinnedGoalIds.includes(goal.id) ? 'Pinned' : 'Pin'}
                        </button>
                      </div>
                      <GoalCard goal={goal} onJackpot={(drop) => setActiveRewardDrop(drop)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <FocusOverlay
        key={focusOpen ? 'open' : 'closed'}
        goals={goals}
        completeTask={mutations.completeTask}
        isOpen={focusOpen}
        onClose={() => setFocusOpen(false)}
      />

      <QuickCaptureModal
        isOpen={quickCaptureOpen}
        goals={goals}
        onClose={() => setQuickCaptureOpen(false)}
        onAddGoal={mutations.addGoal}
        onAddTask={mutations.addTask}
      />

      {activeRewardDrop && (() => {
        const activeRewardId = activeRewardDrop.collectible_key
          ? rewards.find(r => r.reward_key === activeRewardDrop.collectible_key)?.id ?? null
          : null
        return (
          <RewardModal
            drop={activeRewardDrop}
            rewardId={activeRewardId}
            onEquip={(rewardId) => equipMutation.mutate(rewardId)}
            onClose={() => setActiveRewardDrop(null)}
          />
        )
      })()}

      {showCollection && (
        <CollectionModal
          rewards={rewards}
          onEquip={(rewardId) => equipMutation.mutate(rewardId)}
          onClose={() => setShowCollection(false)}
        />
      )}

      {showEnergyModal && (
        <EnergyModal
          isLoading={energyResizeMutation.isPending}
          onConfirm={() => {
            energyResizeMutation.mutate(undefined, {
              onSettled: () => setShowEnergyModal(false),
            })
          }}
          onDismiss={() => setShowEnergyModal(false)}
        />
      )}
    </div>
  )
}
