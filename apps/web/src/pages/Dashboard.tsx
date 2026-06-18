import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/react'
import AppHeader from '../components/AppHeader'
import { Creature } from '../components/GamificationSvgs'
import TodayBar from '../components/TodayBar'
import GreetingStrip from '../components/GreetingStrip'
import Segmented from '../components/ui/Segmented'
import AddGoal from '../components/AddGoal'
import GoalCard from '../components/GoalCard'
import FocusOverlay from '../components/FocusOverlay'
import RewardModal from '../components/RewardModal'
import CollectionModal from '../components/CollectionModal'
import EnergyModal from '../components/EnergyModal'
import CompanionWidget from '../components/CompanionWidget'
import { useBadgesQuery, useGoalsQuery, useProfileQuery, useGoalMutations } from '../hooks'
import { useRewardsQuery, useEquipRewardMutation } from '../hooks/useRewards'
import { useEnergyResizeMutation } from '../hooks/useEnergyMutations'
import { dayDiff, todayStr } from '../lib/gamification'
import type { Goal, RewardDrop } from '../lib/types'
import { useConfetti } from '../components/ConfettiContext'
import { GoalCardSkeleton } from '../components/ui/Skeleton'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

// ── WelcomeBackCard (returning-user nudge) ────────────────────────────────────

const WELCOME_DISMISS_KEY = 'welcome_back_dismissed_at'
const WELCOME_DISMISS_TTL = 24 * 60 * 60 * 1000 // 24 hours

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
    <div className="gf-nudge animate-slide-up" style={{
      '--accent': 'var(--indigo)',
      '--accent-soft': 'color-mix(in oklab, var(--indigo) 10%, transparent)',
      '--accent-line': 'color-mix(in oklab, var(--indigo) 35%, transparent)',
      '--accent-ink': 'var(--indigo)',
      marginBottom: 14,
    } as React.CSSProperties}>
      <div className="gf-nudge-dot" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="gf-nudge-kicker">Welcome back</div>
        <div className="gf-nudge-title">You were away for {state.daysAway} days. No reset needed.</div>
        <div className="gf-nudge-sub">Last completion: {state.lastCompletedDate}. One tiny win gets momentum back.</div>
      </div>
      <button onClick={onFocus} className="gf-btn-ghost-indigo">
        Enter Focus Mode
      </button>
      <button onClick={dismiss} className="gf-nudge-x" aria-label="Dismiss">✕</button>
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

  // amber for overdue, emerald for sprint-complete — override accent vars inline
  const accentColor = isOverdue ? 'var(--gold)' : 'var(--emerald)'
  const accentSoft = isOverdue
    ? 'color-mix(in oklab, var(--gold) 10%, transparent)'
    : 'color-mix(in oklab, var(--emerald) 10%, transparent)'
  const accentLine = isOverdue
    ? 'color-mix(in oklab, var(--gold) 32%, transparent)'
    : 'color-mix(in oklab, var(--emerald) 32%, transparent)'

  return (
    <div className="gf-nudge animate-slide-up" style={{
      '--accent': accentColor,
      '--accent-soft': accentSoft,
      '--accent-line': accentLine,
      '--accent-ink': accentColor,
      marginBottom: 14,
    } as React.CSSProperties}>
      <div className="gf-nudge-dot" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="gf-nudge-kicker">Do this now</div>
        <div className="gf-nudge-title">{label}</div>
        <div className="gf-nudge-sub">{sub}</div>
      </div>
      <button
        onClick={handleAction}
        disabled={completing}
        className="gf-btn-ghost-accent"
        style={{ opacity: completing ? 0.6 : 1, cursor: completing ? 'wait' : 'pointer' }}
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
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        color: 'var(--text)', marginBottom: 10, lineHeight: 1.3,
      }}>
        Your journey starts here ✦
      </h2>
      <p style={{
        fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
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
            className="gf-btn-ghost-indigo"
            style={{ lineHeight: 1.4, textAlign: 'left', height: 'auto', minHeight: 44 }}
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
  const [searchParams] = useSearchParams()
  const onboardingGoal = searchParams.get('goal') ?? undefined
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)
  const { fireBadgeConfetti } = useConfetti()

  const { goals, isLoading: loading, isError, refetch } = useGoalsQuery(userId)
  const { pts } = useProfileQuery(userId)
  const { badges, isLoading: badgesLoading } = useBadgesQuery(userId)
  const unlockedBadgeKeysRef = useRef<Set<string>>(new Set())
  const didInitBadgesRef = useRef(false)

  const [filter, setFilter] = useState<string>('active')
  const [addGoalText, setAddGoalText] = useState('')
  const [focusOpen, setFocusOpen] = useState(false)
  const [activeRewardDrop, setActiveRewardDrop] = useState<RewardDrop | null>(null)
  const [showCollection, setShowCollection] = useState(false)
  const [showEnergyModal, setShowEnergyModal] = useState(() => {
    const triggered = sessionStorage.getItem('energy') === 'low'
    if (triggered) sessionStorage.removeItem('energy')
    return triggered
  })

  const { data: rewards = [] } = useRewardsQuery(userId ?? '')
  const equipMutation = useEquipRewardMutation(userId ?? '')
  const mutations = useGoalMutations(userId ?? '', (drop) => setActiveRewardDrop(drop))
  const energyResizeMutation = useEnergyResizeMutation(userId ?? '')

  useEffect(() => { document.title = 'Dashboard — GoalForge' }, [])

  useEffect(() => {
    // Do not seed or fire while the query is still loading. useBadgesQuery returns
    // badges: [] as the default, so without this guard the ref is seeded with an
    // empty Set on the first render and then confetti fires on every page load for
    // any user who already has badges.
    if (badgesLoading) return

    const unlockedNow = new Set(badges.filter(b => b.unlocked).map(b => b.key))

    if (!didInitBadgesRef.current) {
      unlockedBadgeKeysRef.current = unlockedNow
      didInitBadgesRef.current = true
      return
    }

    const previous = unlockedBadgeKeysRef.current
    const hasNewUnlock = Array.from(unlockedNow).some(key => !previous.has(key))
    if (hasNewUnlock) {
      fireBadgeConfetti()
    }

    unlockedBadgeKeysRef.current = unlockedNow
  }, [badges, badgesLoading, fireBadgeConfetti])

  const error = isError ? 'Failed to load goals.' : null
  const filtered = goals.filter(g => g.status === filter)

  // ── Render ──
  return (
    <div className="min-h-dvh mesh-bg" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>

      <AppHeader pts={pts} onOpenCollection={() => setShowCollection(true)} />

      <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto' }} className="px-4 py-5 sm:px-8 sm:py-7">

        {/* Loading skeletons */}
        {loading && (
          <div role="status" aria-label="Loading goals" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <GoalCardSkeleton />
            <GoalCardSkeleton />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="gf-nudge" style={{
            '--accent': 'var(--rose)',
            '--accent-soft': 'color-mix(in oklab, var(--rose) 10%, transparent)',
            '--accent-line': 'color-mix(in oklab, var(--rose) 32%, transparent)',
            '--accent-ink': 'var(--rose)',
          } as React.CSSProperties}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gf-nudge-kicker">Load error</div>
              <div className="gf-nudge-title">{error}</div>
              <div className="gf-nudge-sub">Check your connection and try again.</div>
            </div>
            <button onClick={() => refetch()} className="gf-btn-ghost-accent">Try again</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <GreetingStrip goals={goals} />
            <WelcomeBackCard goals={goals} onFocus={() => setFocusOpen(true)} />
            <DoThisNow goals={goals} />
            <TodayBar goals={goals} onFocusOpen={() => setFocusOpen(true)} onEnergyOpen={() => setShowEnergyModal(true)} />
            <AddGoal onAdd={mutations.addGoal} value={addGoalText} onChange={setAddGoalText} defaultValue={onboardingGoal} />

            {goals.length === 0 ? (
              <EmptyState onSelect={setAddGoalText} />
            ) : (
              <>
                {/* Filter */}
                <div style={{ marginBottom: 18 }}>
                  <Segmented
                    options={['active', 'achieved', 'abandoned']}
                    value={filter}
                    onChange={setFilter}
                    getLabel={o => `${o} ${goals.filter(g => g.status === o).length}`}
                  />
                </div>

                {/* Goal list */}
                <div aria-live="polite" aria-label="Goal list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '44px 0', color: 'var(--text-mute)', fontSize: 13 }}>
                      No goals here yet.
                    </div>
                  )}
                  {filtered.map(goal => (
                    <div key={goal.id} id={`goal-card-${goal.id}`}>
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

      {activeRewardDrop && (() => {
        const drop = activeRewardDrop
        const activeRewardId = drop.collectible_key
          ? rewards.find(r => r.reward_key === drop.collectible_key)?.id ?? null
          : null
        return (
          <RewardModal
            drop={drop}
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

      <CompanionWidget pts={pts} />
    </div>
  )
}
