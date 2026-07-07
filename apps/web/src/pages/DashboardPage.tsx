// pages/DashboardPage.tsx — compact greeting + goal-creation hero + goal cards.
// Transcribed from design_handoff_goalforge/app/gf-dashboard.jsx. Mock goal
// toggling/creation is replaced with real useGoalMutations wiring (Dashboard
// remains the single authoritative owner per CLAUDE.md — GoalCard receives
// mutations as a prop). Onboarding ?goal= handoff and badge-confetti wiring
// are lifted from the legacy Dashboard.tsx (behavior only, not markup).
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/react'
import { Icon, Reveal, Segmented } from '../components/gf/Ui'
import { cx } from '../components/gf/util'
import GoalCard from '../components/gf/GoalCard'
import { useBadgesQuery, useGoalsQuery, useGoalMutations } from '../hooks'
import { useRewardsQuery, useEquipRewardMutation } from '../hooks/useRewards'
import { useConfetti } from '../components/ConfettiContext'
import { GoalCardSkeleton } from '../components/ui/Skeleton'
import RewardModal from '../components/RewardModal'
import { toGoalView } from '../lib/goalView'
import type { Goal, RewardDrop } from '../lib/types'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

function greetingFor(h: number) {
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// ── Compact greeting strip ──────────────────────────────────────────────────────
function GreetingStrip({ goals }: { goals: Goal[] }) {
  const { user } = useUser()
  const name = user?.firstName ?? 'there'
  // Greeting computed once on mount (ESLint bans new Date() in render body).
  const [greeting] = useState(() => greetingFor(new Date().getHours()))

  const allTasks = goals.filter(g => g.status === 'active').flatMap(g => toGoalView(g).tasks)
  const done = allTasks.filter(t => t.done).length
  const total = allTasks.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <Reveal className="gf-greet" delay={0}>
      <div className="gf-greet-l">
        <img src="/solly/waving-hand.svg" alt="" className="gf-greet-wave" width={34} height={34} />
        <div>
          <div className="gf-greet-hi">{greeting}, {name}</div>
          <div className="gf-greet-sub">{done} of {total} tasks done today</div>
        </div>
      </div>
      <div className="gf-greet-prog">
        <div className="gf-greet-prog-head">
          <span className="gf-greet-prog-pct">{pct}<span>%</span></span>
          <span className="gf-greet-prog-lbl">today</span>
        </div>
        <div className="gf-greet-prog-track">
          <div className="gf-greet-prog-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Reveal>
  )
}

// ── Typewriter placeholder ───────────────────────────────────────────────────────
const TYPE_EXAMPLES = [
  'run a 5k in 8 weeks', 'ship my side project this month', 'read 12 books this year',
  'learn Spanish in 6 months', 'wake up at 6am every day', 'save $5,000 by August',
]

function useTypewriter(active: boolean) {
  const [txt, setTxt] = useState('')
  const [exampleIdx, setExampleIdx] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  useEffect(() => {
    if (!active) return
    const cur = TYPE_EXAMPLES[exampleIdx]
    if (!isDeleting && txt === cur) {
      const t = setTimeout(() => setIsDeleting(true), 1900)
      return () => clearTimeout(t)
    }
    if (isDeleting && txt === '') {
      const t = setTimeout(() => {
        setIsDeleting(false)
        setExampleIdx(i => (i + 1) % TYPE_EXAMPLES.length)
      }, 360)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setTxt(isDeleting ? cur.slice(0, txt.length - 1) : cur.slice(0, txt.length + 1))
    }, isDeleting ? 34 : 70)
    return () => clearTimeout(t)
  }, [txt, isDeleting, exampleIdx, active])
  return txt
}

// ── Goal-creation hero (the centerpiece) ─────────────────────────────────────────
const CATEGORY_CHIPS = [
  { ic: 'run', label: 'Get fit', prompt: 'Build a consistent workout habit and lose 10 pounds over 3 months' },
  { ic: 'book', label: 'Learn something', prompt: 'Learn Spanish from scratch and hold a basic conversation in 6 months' },
  { ic: 'bolt', label: 'Financial goal', prompt: 'Save $5,000 in an emergency fund over the next 6 months' },
  { ic: 'spark', label: 'Creative project', prompt: 'Write the first draft of a short novel in 90 days' },
  { ic: 'heart', label: 'Wellness', prompt: 'Meditate for at least 10 minutes every day for 30 days' },
]

interface GoalCreationProps {
  value: string
  onChange: (v: string) => void
  onCreate: (rawInput: string) => Promise<void>
}

function GoalCreation({ value, onChange, onCreate }: GoalCreationProps) {
  const [focused, setFocused] = useState(false)
  const [status, setStatus] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle')
  const typed = useTypewriter(!focused && !value)

  async function submit() {
    if (!value.trim() || status === 'thinking') return
    setStatus('thinking')
    try {
      await onCreate(value.trim())
      onChange('')
      setStatus('done')
      setTimeout(() => setStatus('idle'), 1100)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 1500)
    }
  }

  return (
    <div className="gf-create-wrap">
      <div className="gf-create-amb" aria-hidden="true">
        <span className="gf-amb o1" /><span className="gf-amb o2" /><span className="gf-amb o3" /><span className="gf-amb o4" />
      </div>
      <Reveal className={cx('gf-create', focused && 'is-focus')} delay={60}>
        <div className="gf-create-bg" />
        <div className="gf-create-blob a" />
        <div className="gf-create-blob b" />
        <div className="gf-create-in">
          <div className="gf-create-eyebrow">What&apos;s your next goal?</div>
          <div className="gf-create-pillwrap">
            <div className="gf-create-pill">
              <span className="gf-create-star"><Icon name="spark" size={17} /></span>
              <div className="gf-create-field">
                <input className="gf-create-input" value={value} onChange={e => onChange(e.target.value)}
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                  onKeyDown={e => { if (e.key === 'Enter') void submit() }} aria-label="Describe your goal" />
                {!value && (
                  <div className="gf-create-ph">{focused ? <span className="dim">Describe a goal…</span> : <>e.g.&nbsp;{typed}<span className="gf-caret">|</span></>}</div>
                )}
              </div>
              <button className={cx('gf-create-go', value.trim() && 'is-on')} onClick={() => void submit()} aria-label="Create goal">
                {status === 'thinking' ? <span className="gf-create-dots">···</span> : <Icon name="arrowUp" size={18} stroke={2.4} />}
              </button>
            </div>
          </div>
          <div className="gf-create-chips">
            {CATEGORY_CHIPS.map(c => (
              <button key={c.label} className="gf-create-chip" onClick={() => onChange(c.prompt)}>
                <Icon name={c.ic} size={13} /> {c.label}
              </button>
            ))}
          </div>
          {status === 'thinking' && <div className="gf-create-status think">◉ AI is forging your plan…</div>}
          {status === 'done' && <div className="gf-create-status done"><Icon name="check" size={12} stroke={3} /> Goal added!</div>}
          {status === 'error' && <div className="gf-create-status error">✕ Could not create goal — try again.</div>}
        </div>
      </Reveal>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────────
type Filter = 'active' | 'achieved' | 'abandoned'

export default function DashboardPage() {
  const [searchParams] = useSearchParams()
  const onboardingGoal = searchParams.get('goal') ?? undefined
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)
  const { fireBadgeConfetti } = useConfetti()

  const { goals, isLoading: loading, isError, refetch } = useGoalsQuery(userId)
  const { badges, isLoading: badgesLoading } = useBadgesQuery(userId)
  const unlockedBadgeKeysRef = useRef<Set<string>>(new Set())
  const didInitBadgesRef = useRef(false)

  const [filter, setFilter] = useState<Filter>('active')
  // Onboarding hands the goal text off via ?goal= — prefill only, no auto-submit
  // (matches legacy AddGoal.tsx contract). Lazy initializer per project ESLint rules.
  const [addGoalText, setAddGoalText] = useState(() => onboardingGoal ?? '')
  const [activeRewardDrop, setActiveRewardDrop] = useState<RewardDrop | null>(null)

  const { data: rewards = [] } = useRewardsQuery(userId ?? '')
  const equipMutation = useEquipRewardMutation(userId ?? '')
  const mutations = useGoalMutations(userId ?? '', (drop) => setActiveRewardDrop(drop))

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
    if (hasNewUnlock) fireBadgeConfetti()

    unlockedBadgeKeysRef.current = unlockedNow
  }, [badges, badgesLoading, fireBadgeConfetti])

  const error = isError ? 'Failed to load goals.' : null
  const counts: Record<Filter, number> = {
    active: goals.filter(g => g.status === 'active').length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    abandoned: goals.filter(g => g.status === 'abandoned').length,
  }
  const filtered = goals.filter(g => g.status === filter)

  return (
    <>
      {loading && (
        <div role="status" aria-label="Loading goals" className="gf-page">
          <GoalCardSkeleton />
          <GoalCardSkeleton />
        </div>
      )}

      {!loading && error && (
        <div className="gf-page">
          <div className="gf-nudge is-rose">
            <div className="gf-nudge-body">
              <div className="gf-nudge-kicker">Load error</div>
              <div className="gf-nudge-title">{error}</div>
              <div className="gf-nudge-sub">Check your connection and try again.</div>
            </div>
            <button onClick={() => refetch()} className="gf-btn-ghost-accent">Try again</button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="gf-page">
          <GreetingStrip goals={goals} />
          <GoalCreation value={addGoalText} onChange={setAddGoalText} onCreate={mutations.addGoal} />

          <div className="gf-listhead">
            <Reveal as="h2" className="gf-h2" delay={40}>Your goals</Reveal>
            <Reveal delay={60}>
              <Segmented options={['active', 'achieved', 'abandoned'] as Filter[]} value={filter} onChange={setFilter}
                getLabel={o => `${o} ${counts[o]}`} />
            </Reveal>
          </div>

          {filtered.length === 0 ? (
            <div className="gf-empty">
              <div className="gf-empty-ic"><Icon name="trophy" size={26} /></div>
              <div className="gf-empty-t">{filter === 'abandoned' ? 'Nothing abandoned — you’re holding the line.' : 'No goals here yet.'}</div>
            </div>
          ) : (
            <div className="gf-goallist">
              {filtered.map((goal, i) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  index={i}
                  defaultOpen={i === 0 && filter === 'active'}
                  mutations={mutations}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
    </>
  )
}
