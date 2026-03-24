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
import { useGoalsQuery, useProfileQuery, useGoalMutations } from '../hooks'
import { useRewardsQuery, useEquipRewardMutation } from '../hooks/useRewards'
import { todayStr } from '../lib/gamification'
import type { Goal, RewardDrop } from '../lib/types'

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

// ── Dashboard (main page) ─────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useUser()
  const userId = user?.id

  const { goals, isLoading: loading, isError, refetch } = useGoalsQuery(userId)
  const { pts } = useProfileQuery(userId)

  const [filter, setFilter] = useState<string>('all')
  const [addGoalText, setAddGoalText] = useState('')
  const [focusOpen, setFocusOpen] = useState(false)
  const [activeRewardDrop, setActiveRewardDrop] = useState<RewardDrop | null>(null)
  const [showCollection, setShowCollection] = useState(false)

  const { data: rewards = [] } = useRewardsQuery(userId ?? '')
  const equipMutation = useEquipRewardMutation(userId ?? '')
  const mutations = useGoalMutations(userId ?? '', (drop) => setActiveRewardDrop(drop))

  useEffect(() => { document.title = 'Dashboard — GoalForge' }, [])

  const error = isError ? 'Failed to load goals.' : null
  const filtered = filter === 'all' ? goals : goals.filter(g => g.status === filter)

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
            <DoThisNow goals={goals} />
            <TodayBar goals={goals} onFocusOpen={() => setFocusOpen(true)} />
            <AddGoal onAdd={mutations.addGoal} value={addGoalText} onChange={setAddGoalText} />

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
                  {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '44px 0', color: T.muted, fontSize: 13 }}>
                      No goals here yet.
                    </div>
                  )}
                  {filtered.map(goal => (
                    <div key={goal.id} id={`goal-card-${goal.id}`}>
                      <GoalCard goal={goal} />
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
    </div>
  )
}
