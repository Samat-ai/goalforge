// pages/ChatPage.tsx — Chat (Coach) v2: two-pane session shell over the real
// coach backend. Transcribed from design_handoff_goalforge/chat-v2/gf-coach-v2.jsx
// (CoachV2 root lines 506-671, ChatHeader 434-450, Composer 452-476, NewChatEmpty
// 478-501, CoachMsg/PlanCard 204-290). The package runs on inline mock sessions and
// local state only; this port rewires it onto PR 1's real hooks (useCoachSessionsQuery
// / useCoachSessionQuery / useCreateCoachSessionMutation / useSendCoachMessageMutation
// / useDeleteCoachSessionMutation) with the plan's Mandated Adaptations:
//   • no dangerouslySetInnerHTML — safe renderItalics() React renderer (Adaptation 1)
//   • no render-body Date.now() — keyed <HeaderSub> with lazy useState (Adaptation 2)
//   • cap detection via isCapMessage() content equality (Adaptation 5)
//   • plan cards hydrate from the goals list query, not the send result (Adaptation 6)
// The send lifecycle here is PR 1 parity (plain instant replies): the word-stream /
// stop / error-retry mechanics land in Task 5 — `generating` is wired false and the
// package's stop branch stays dormant until then.
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useUser } from '@clerk/react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '../components/gf/Ui'
import { cx } from '../components/gf/util'
import CoachRail, { type CoachRailProps } from '../components/gf/CoachRail'
import CoachDrawer from '../components/gf/CoachDrawer'
import SollyIdle from '../components/SollyIdle'
import { CoachPanelSkeleton } from '../components/ui/Skeleton'
import {
  useAllGoalsQuery,
  useCoachSessionQuery,
  useCoachSessionsQuery,
  useCreateCoachSessionMutation,
  useDeleteCoachSessionMutation,
  useSendCoachMessageMutation,
} from '../hooks'
import { fallbackTitle, isCapMessage, relTime } from '../lib/coachView'
import type { CoachSession, Goal } from '../lib/types'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

// minimal *italic* -> <em>, rendered as React elements (Mandated Adaptation 1 —
// the package's mdItalics()+innerHTML would render user/model text as HTML)
function renderItalics(text: string): ReactNode[] {
  return text.split(/(\*[^*]+\*)/g).filter(Boolean).map((seg, i) =>
    seg.length > 1 && seg.startsWith('*') && seg.endsWith('*')
      ? <em key={i}>{seg.slice(1, -1)}</em>
      : <span key={i}>{seg}</span>,
  )
}

const THINK_VARIANTS = ['shimmer', 'pulse', 'wave'] as const

function TypingDots() {
  const [variant] = useState(() => THINK_VARIANTS[Math.floor(Math.random() * THINK_VARIANTS.length)])
  return (
    <div className="gf-co-msg gf-co-assistant gf-co-think">
      {variant === 'shimmer' && <span className="gf-think-shimmer">Thinking</span>}
      {variant === 'pulse' && (
        <span className="gf-think-pulse" role="status" aria-label="Thinking"><i /><span>Thinking</span></span>
      )}
      {variant === 'wave' && (
        <span className="gf-think-wave" role="status" aria-label="Thinking"><i /><i /><i /></span>
      )}
    </div>
  )
}

// Refined plan card (package PlanCard, lines 259-290) hydrated from a real Goal
// (Mandated Adaptation 6). "Refine" focuses the composer; the kbd-accent primary
// is a real Link to /dashboard (package button was inert).
function PlanCard({ goal, onRefine }: { goal: Goal; onRefine: () => void }) {
  const tasks = goal.daily_tasks.slice(0, 3)
  return (
    <div className="gf-co-plan">
      <div className="gf-co-plan-top">
        <span className="gf-co-plan-badge"><Icon name="spark" size={17} /></span>
        <div className="gf-co-plan-eyebrow">Plan forged</div>
      </div>
      <div className="gf-co-plan-body">
        <h3 className="gf-co-plan-title">{goal.smart_title}</h3>
        <p className="gf-co-plan-desc">{goal.smart_description}</p>
        <div className="gf-co-plan-grid">
          <div>
            <div className="gf-co-plan-h">Sprint milestones <b>{goal.milestones.length}</b></div>
            <ol className="gf-co-plan-timeline">
              {goal.milestones.map((s, i) => <li key={s.id}><span className="gf-co-plan-num">{i + 1}</span>{s.title}</li>)}
            </ol>
          </div>
          <div>
            <div className="gf-co-plan-h">First tasks <b>{tasks.length}</b></div>
            <ul className="gf-co-plan-tasks">
              {tasks.map(t => <li key={t.id}><span className="gf-co-plan-tick"><Icon name="check" size={11} stroke={3} /></span>{t.description}</li>)}
            </ul>
          </div>
        </div>
      </div>
      <div className="gf-co-plan-foot">
        <button className="gf-btn gf-btn-soft" onClick={onRefine}>Refine</button>
        <Link to="/dashboard" className="gf-btn gf-btn-accent" aria-label="Open Dashboard">
          <span className="gf-co-plan-kbd"><Icon name="enter" size={14} stroke={2.2} /></span>
        </Link>
      </div>
    </div>
  )
}

// Package CoachMsg (lines 204-232) incl. the rest-variant cap bubble (207-220).
// The action row keeps PRODUCTION behavior (copy → clipboard, good → transient
// ack) inside the package markup — the package's MsgActions is inert (plan
// "Deviations & notes": production behavior wins).
function CoachMsg({ content, animate, rest, goal, onRefine }: {
  content: string
  animate: boolean
  rest: boolean
  goal: Goal | null
  onRefine: () => void
}) {
  const [acked, setAcked] = useState<'copy' | 'good' | null>(null)
  const ackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(ackTimer.current), [])
  const ack = (kind: 'copy' | 'good') => {
    setAcked(kind)
    clearTimeout(ackTimer.current)
    ackTimer.current = setTimeout(() => setAcked(null), 1500)
  }
  const copy = () => {
    navigator.clipboard?.writeText(content).then(() => ack('copy')).catch(() => {})
  }
  const actions = (
    <div className="gf-co-actions">
      <button className="gf-co-act" aria-label={acked === 'copy' ? 'Copied' : 'Copy message'} onClick={copy}><Icon name="check" size={14} /></button>
      <button className="gf-co-act" aria-label={acked === 'good' ? 'Thanks for the feedback' : 'Good response'} onClick={() => ack('good')}><Icon name="spark" size={14} /></button>
    </div>
  )
  // daily-cap "resting Solly" is still an ordinary coach bubble — just with a
  // small resting mascot beside the text. No alarm styling.
  if (rest) {
    return (
      <div className={cx('gf-co-msg gf-co-assistant', animate && 'gf-co-in')}>
        <div className="gf-co-rest">
          <div className="gf-co-rest-av">
            <img src="/solly/solly-tired.svg" alt="Solly resting" />
            <span className="gf-co-rest-z" aria-hidden="true">z</span>
          </div>
          <div className="gf-co-text">{renderItalics(content)}</div>
        </div>
        {actions}
      </div>
    )
  }
  return (
    <div className={cx('gf-co-msg gf-co-assistant', animate && 'gf-co-in')}>
      <div className="gf-co-text">{renderItalics(content)}</div>
      {goal && <PlanCard goal={goal} onRefine={onRefine} />}
      {actions}
    </div>
  )
}

function UserMsg({ content, animate }: { content: string; animate: boolean }) {
  return (
    <div className={cx('gf-co-msg gf-co-user', animate && 'gf-co-in')}>
      <div className="gf-co-userbub">{content}</div>
    </div>
  )
}

// Render-safe relative time (Mandated Adaptation 2): Date.now() only inside the
// lazy initializer; the caller keys this on session.updated_at so it remounts —
// and re-reads the clock — exactly when the timestamp actually changes.
function HeaderSub({ updatedAt }: { updatedAt: string }) {
  const [txt] = useState(() => relTime(updatedAt, Date.now()))
  return <>Updated {txt}</>
}

// Package ChatHeader (lines 434-450): collapse/expand + drawer triggers, Solly
// avatar, session title via fallbackTitle, status subline.
function ChatHeader({ session, capped, railOpen, onOpenDrawer, onExpand }: {
  session: CoachSession | null
  capped: boolean
  railOpen: boolean
  onOpenDrawer: () => void
  onExpand: () => void
}) {
  const firstUser = session?.messages.find(m => m.role === 'user')
  const info = session
    ? fallbackTitle({ title: session.title, preview: firstUser?.content ?? null })
    : { text: 'New chat', fallback: true }
  return (
    <div className="gf-co-head">
      {!railOpen && <button className="gf-co-collapse-btn" aria-label="Show sidebar" onClick={onExpand}><Icon name="panel" size={18} /></button>}
      <button className="gf-co-drawer-btn" aria-label="Open conversations" onClick={onOpenDrawer}><Icon name="menu" size={19} /></button>
      <div className="gf-co-head-l">
        <div className="gf-co-av"><img src="/solly/solly.png" alt="Solly" className="gf-co-solly" width={34} height={34} /></div>
        <div className="gf-co-head-txt">
          <div className={cx('gf-co-head-title', info.fallback && 'is-fallback')}>{info.text}</div>
          <div className="gf-co-head-sub">
            {session
              ? (capped ? 'Resting until tomorrow' : <HeaderSub key={session.updated_at} updatedAt={session.updated_at} />)
              : 'AI goal coach'}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ComposerProps {
  draft: string
  setDraft: (v: string) => void
  onSend: (text: string) => void
  chips: string[]
  onChip: (c: string) => void
  generating: boolean
  onStop: () => void
  // Lifted out of the package's internal ref so PlanCard's "Refine" can focus
  // the composer from outside (host adaptation; markup unchanged).
  taRef: RefObject<HTMLTextAreaElement | null>
  hero?: boolean
}

// Package Composer (lines 452-476): floating over the feed in thread view,
// static `is-hero` inside the empty state. Chips render inside
// .gf-co-composer-in, above the input bar.
function Composer({ draft, setDraft, onSend, chips, onChip, generating, onStop, taRef, hero }: ComposerProps) {
  const grow = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }
  const send = () => {
    if (!draft.trim() || generating) return
    onSend(draft.trim())
    if (taRef.current) taRef.current.style.height = 'auto'
  }
  return (
    <div className={cx('gf-co-composer', hero && 'is-hero')}>
      <div className="gf-co-composer-in">
        {chips.length > 0 && (
          <div className="gf-co-chips">
            {chips.map(c => <button key={c} className="gf-co-chip" onClick={() => onChip(c)}>{c}</button>)}
          </div>
        )}
        <div className="gf-co-inputbar">
          <textarea
            ref={taRef}
            className="gf-co-input"
            rows={1}
            placeholder="Message Solly…"
            aria-label="Message Solly"
            value={draft}
            onChange={grow}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button
            className={cx('gf-co-send', (generating || draft.trim()) && 'is-on')}
            onClick={generating ? onStop : send}
            aria-label={generating ? 'Stop generating' : 'Send message'}
            disabled={!generating && !draft.trim()}
          >
            <Icon name={generating ? 'stop' : 'arrowUp'} size={generating ? 15 : 18} stroke={2.4} />
          </button>
        </div>
        {!hero && <div className="gf-co-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</div>}
      </div>
    </div>
  )
}

// Package NewChatEmpty (lines 478-501): centered hero owning an `is-hero`
// composer; starter pills FILL the draft (no auto-send, consistent with the chip
// rule). Uses the production SollyIdle (PNG bob + webm crossfade) instead of the
// package's local copy — plan "Deviations & notes".
function NewChatEmpty({ composerProps, onStarter }: {
  composerProps: ComposerProps
  onStarter: (label: string) => void
}) {
  const starters = [
    { label: 'Get fit & moving', icon: 'target', color: 'var(--rose)' },
    { label: 'Finish my side project', icon: 'bolt', color: 'var(--accent)' },
    { label: 'Build a reading habit', icon: 'book', color: 'var(--indigo)' },
    { label: 'Beat procrastination', icon: 'spark', color: 'var(--gold)' },
  ]
  return (
    <div className="gf-co-empty">
      <div className="gf-co-empty-av"><div className="gf-co-solly-lg"><SollyIdle /></div></div>
      <h2 className="gf-co-empty-title">{"Let's forge your next goal"}</h2>
      <div className="gf-co-empty-composer">
        <Composer {...composerProps} hero />
      </div>
      <div className="gf-co-starters">
        {starters.map(s => (
          <button key={s.label} className="gf-co-starter" onClick={() => onStarter(s.label)}>
            <Icon name={s.icon} size={15} style={{ color: s.color }} /> {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)

  const { sessions, isLoading: isListLoading } = useCoachSessionsQuery(userId)
  // undefined = no explicit choice yet (defaults to the most recent session);
  // null = user clicked "New chat" (explicit empty-state); string = explicit
  // session id. A plain `string | null` can't tell "unset" apart from "user
  // chose new chat" since both would be `null` — that collapses the `??`
  // fallback below and the New Chat button would silently reopen the most
  // recent thread instead of showing the empty state. Kept as a pure render-time
  // derivation (no effect) to avoid the set-state-in-effect lint ban.
  const [activeSessionId, setActiveSessionId] = useState<string | null | undefined>(undefined)
  const currentSessionId = activeSessionId !== undefined ? activeSessionId : (sessions[0]?.id ?? null)
  const { session, isLoading: isSessionLoading } = useCoachSessionQuery(userId, currentSessionId)
  const { create, isCreating } = useCreateCoachSessionMutation(userId ?? '')
  const { send, isSending } = useSendCoachMessageMutation(userId ?? '')
  const { remove } = useDeleteCoachSessionMutation(userId ?? '')
  // Plan-card hydration source (Mandated Adaptation 6) — same query key +
  // limit-100 fetch Analytics uses, so the caches are shared.
  const { goals } = useAllGoalsQuery(userId)

  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // stable identity: the drawer's focus-trap effect must not re-fire on ChatPage re-renders
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const [railOpen, setRailOpen] = useState(true)
  const [draft, setDraft] = useState('')
  const feedRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  const isLoading = isListLoading || isSessionLoading
  const messages = useMemo(() => session?.messages ?? [], [session?.messages])
  const goalsById = useMemo(() => new Map(goals.map(g => [g.id, g])), [goals])

  useEffect(() => { document.title = 'Chat — GoalForge' }, [])

  useEffect(() => {
    const f = feedRef.current
    if (f) f.scrollTo({ top: f.scrollHeight, behavior: 'smooth' })
  }, [currentSessionId, messages.length, isSending])

  // last coach turn's chips drive the composer chip row (0-4 chips) — package
  // memo (line 527); its `typing || stream` gate maps to isSending at this
  // task's parity level (Task 5 adds the stream gate).
  const chips = useMemo(() => {
    if (!session || isSending) return []
    const last = session.messages[session.messages.length - 1]
    return last && last.role === 'coach' && last.chips ? last.chips : []
  }, [session, isSending])

  // Daily-cap state: the header sub swaps to "Resting until tomorrow" when the
  // latest coach turn is the backend cap line (Mandated Adaptation 5).
  const lastCoach = useMemo(() => [...messages].reverse().find(m => m.role === 'coach'), [messages])
  const capped = !!lastCoach && isCapMessage(lastCoach.content)

  function selectSession(id: string) {
    setActiveSessionId(id)
    setConfirmId(null)
    setDrawerOpen(false)
    setDraft('')
  }

  function newChat() {
    setActiveSessionId(null)
    setConfirmId(null)
    setDrawerOpen(false)
    setDraft('')
  }

  function handleDelete(id: string) {
    // Fall back BEFORE the mutation resolves (package semantics): compute the
    // remaining list from the current one minus id; the hook's list
    // invalidation reconciles afterwards.
    if (id === currentSessionId) {
      const remaining = sessions.filter(s => s.id !== id)
      setActiveSessionId(remaining[0]?.id ?? null)
    }
    setConfirmId(null)
    remove(id).catch(() => toast.error('Could not delete the chat. Please try again.'))
  }

  async function handleSend(text: string) {
    if (!userId || isSending || isCreating) return
    const content = text.trim()
    if (!content) return
    // Clear the composer immediately — the message optimistically appears in
    // the thread (useSendCoachMessageMutation.onMutate); restore on failure.
    setDraft('')
    try {
      // Lazy create (PR 1): sending from the new-chat empty state creates the
      // session first, then sends into it.
      let sid = currentSessionId
      if (!sid) {
        const created = await create()
        setActiveSessionId(created.id)
        sid = created.id
      }
      await send({ sessionId: sid, content })
    } catch {
      // PR 1 parity — Task 5 replaces this with the inline error+retry row.
      setDraft(content)
      toast.error('Coach message failed. Please retry.')
    }
  }

  const railProps: CoachRailProps = {
    sessions,
    activeId: currentSessionId,
    confirmId,
    onSelect: selectSession,
    onNewChat: newChat,
    setConfirmId,
    onDelete: handleDelete,
  }
  const composerProps: ComposerProps = {
    draft,
    setDraft,
    onSend: t => { void handleSend(t) },
    chips,
    onChip: c => setDraft(c),
    // Stop/stream lifecycle is Task 5's — until then the send button never
    // morphs to stop; handleSend guards double-sends while a reply is in flight.
    generating: false,
    onStop: () => undefined,
    taRef,
  }

  return (
    <div className="gf-co-wrap">
      {isLoading ? (
        <div className="py-6"><CoachPanelSkeleton /></div>
      ) : (
        <div className={cx('gf-co-shell', !railOpen && 'is-railcollapsed')}>
          {/* desktop rail */}
          <CoachRail {...railProps} collapsible onCollapse={() => setRailOpen(false)} />

          {/* thread pane */}
          <div className="gf-co-pane">
            <ChatHeader
              session={session}
              capped={capped}
              railOpen={railOpen}
              onOpenDrawer={() => setDrawerOpen(true)}
              onExpand={() => setRailOpen(true)}
            />
            <div className="gf-co-feed" ref={feedRef}>
              {session ? (
                <div className="gf-co-thread">
                  {messages.map((m, i) => {
                    const isLast = i === messages.length - 1
                    if (m.role === 'user') {
                      return <UserMsg key={m.id} content={m.content} animate={isLast} />
                    }
                    // goal deleted (or not on the list yet) ⇒ no card, just the text
                    const goal = m.forged_goal_id ? goalsById.get(m.forged_goal_id) ?? null : null
                    return (
                      <CoachMsg
                        key={m.id}
                        content={m.content}
                        animate={isLast}
                        rest={isCapMessage(m.content)}
                        goal={goal}
                        onRefine={() => taRef.current?.focus()}
                      />
                    )
                  })}
                  {isSending && <TypingDots />}
                </div>
              ) : (
                <NewChatEmpty composerProps={composerProps} onStarter={label => setDraft(label)} />
              )}
            </div>
            {/* bottom composer only when a thread is open; the empty state owns its own centered composer */}
            {session && <Composer {...composerProps} />}
          </div>
        </div>
      )}

      {/* mobile drawer — portaled to <body> (SettingsPage precedent): the
          fixed-position drawer/scrim must escape PageSwitcher's .gf-xfade
          wrapper, whose will-change: transform makes it the containing block
          for fixed descendants (the drawer would pin to the page box instead
          of the viewport). Tokens live on :root/[data-theme] so theming holds;
          the .gf-root-scoped :focus-visible rules are restated for .gf-co-drawer
          in the chat CSS block (host-adapted). */}
      {createPortal(
        <CoachDrawer open={drawerOpen} onClose={closeDrawer} railProps={railProps} />,
        document.body,
      )}
    </div>
  )
}
