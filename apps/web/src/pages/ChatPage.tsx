// pages/ChatPage.tsx — Chat (Coach) v2: two-pane session shell over the real
// coach backend. Transcribed from design_handoff_goalforge/chat-v2/gf-coach-v2.jsx
// (CoachV2 root lines 506-671, ChatHeader 434-450, Composer 452-476, NewChatEmpty
// 478-501, CoachMsg/PlanCard 204-290). The package runs on inline mock sessions and
// local state only; this port rewires it onto PR 1's real hooks (useCoachSessionsQuery
// / useCoachSessionQuery / useCreateCoachSessionMutation / useSendCoachMessageMutation
// / useDeleteCoachSessionMutation) with the plan's Mandated Adaptations:
//   • no dangerouslySetInnerHTML — safe renderItalics() React renderer (Adaptation 1)
//   • no render-body Date.now() — keyed <HeaderSub> with lazy useState (Adaptation 2)
//   • stop never desyncs the thread — the server persists the turn (Adaptation 3)
//   • send failure renders the inline error+retry row, no toast (Adaptation 4)
//   • cap detection via isCapMessage() content equality (Adaptation 5)
//   • plan cards hydrate from the goals list query, not the send result (Adaptation 6)
// Send lifecycle (package startStream 554-570 / stop 591-605 / error row 650-656):
// after a send resolves, the newest coach reply reveals word-by-word (48ms/word) via
// a `stream` mask over content that is ALREADY committed to the query cache — so
// stopping mid-reveal, reduced motion, or a session switch always land on the full
// server truth. Plan-card (`forged_goal_id`) and daily-cap replies pop complete.
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
  useCoachUsageQuery,
  useCreateCoachSessionMutation,
  useDeleteCoachSessionMutation,
  useSendCoachMessageMutation,
} from '../hooks'
import { fallbackTitle, isCapMessage, relTime, resetTimeLabel, splitWords, usageRing } from '../lib/coachView'
import type { CoachMessage, CoachSession, CoachUsage, Goal } from '../lib/types'

// circumference of the usage ring circle (r=21 in a 44×44 viewBox)
const RING_C = 2 * Math.PI * 21

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

// Package CoachMsg (lines 204-232) incl. the rest-variant cap bubble (207-220)
// and the word-reveal branch (221-231): while this message is streaming
// (streamN != null) the text renders as the first N word-chunks — raw, exactly
// like the package (italics apply on commit) — and the plan card + action row
// stay hidden until the reveal commits. The action row keeps PRODUCTION
// behavior (copy → clipboard, good → transient ack) inside the package markup —
// the package's MsgActions is inert (plan "Deviations & notes": production
// behavior wins).
function CoachMsg({ content, animate, rest, goal, streamN, onRefine }: {
  content: string
  animate: boolean
  rest: boolean
  goal: Goal | null
  streamN: number | null
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
  const streaming = streamN != null
  return (
    <div className={cx('gf-co-msg gf-co-assistant', animate && 'gf-co-in')}>
      {streaming
        ? (
          <div className="gf-co-text">
            {splitWords(content).slice(0, streamN).map((w, idx) => <span key={idx} className="gf-co-word">{w}</span>)}
          </div>
        )
        : <div className="gf-co-text">{renderItalics(content)}</div>}
      {goal && !streaming && <PlanCard goal={goal} onRefine={onRefine} />}
      {!streaming && actions}
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
function ChatHeader({ session, capped, resetLabel, railOpen, onOpenDrawer, onExpand }: {
  session: CoachSession | null
  capped: boolean
  resetLabel: string | null
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
              ? (capped
                  ? `Resting until tomorrow${resetLabel ? ` · back at ${resetLabel}` : ''}`
                  : <HeaderSub key={session.updated_at} updatedAt={session.updated_at} />)
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
  // another session's turn is in flight: sends are blocked globally, but this
  // session must NOT render a Stop button for a turn that isn't its own —
  // the send arrow just disables until the other turn settles
  busyElsewhere: boolean
  onStop: () => void
  // Lifted out of the package's internal ref so PlanCard's "Refine" can focus
  // the composer from outside (host adaptation; markup unchanged).
  taRef: RefObject<HTMLTextAreaElement | null>
  usage: CoachUsage | null
  hero?: boolean
}

// Package Composer (lines 452-476): floating over the feed in thread view,
// static `is-hero` inside the empty state. Chips render inside
// .gf-co-composer-in, above the input bar.
function Composer({ draft, setDraft, onSend, chips, onChip, generating, busyElsewhere, onStop, taRef, usage, hero }: ComposerProps) {
  // Daily-cap ring around the send button — hidden until half the allowance is
  // used (progressive disclosure), amber at <=3 left. See coachView.usageRing.
  const ring = usage ? usageRing(usage.used, usage.limit) : null
  const remaining = usage ? usage.limit - Math.min(usage.used, usage.limit) : 0
  const usageTitle = usage && ring?.visible
    ? `${remaining} of ${usage.limit} messages left today · resets ${resetTimeLabel(usage.resets_at)}`
    : undefined
  const grow = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }
  const send = () => {
    if (!draft.trim() || generating || busyElsewhere) return
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
          <span className="gf-co-send-wrap" title={usageTitle}>
            {ring && (
              <svg
                className={cx('gf-co-ring', ring.visible && 'is-on', ring.warn && 'is-warn')}
                viewBox="0 0 44 44"
                aria-hidden="true"
              >
                <circle className="gf-co-ring-track" cx="22" cy="22" r="21" />
                <circle
                  className="gf-co-ring-fill"
                  cx="22" cy="22" r="21"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - ring.fraction)}
                />
              </svg>
            )}
            <button
              className={cx('gf-co-send', (generating || draft.trim()) && 'is-on')}
              onClick={generating ? onStop : send}
              aria-label={generating ? 'Stop generating' : 'Send message'}
              disabled={busyElsewhere || (!generating && !draft.trim())}
            >
              <Icon name={generating ? 'stop' : 'arrowUp'} size={generating ? 15 : 18} stroke={2.4} />
            </button>
          </span>
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
  const { usage } = useCoachUsageQuery(userId)
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
  // ── Send lifecycle (package lines 554-605 + Mandated Adaptations 3-4) ──
  // Word-reveal mask over the newest live coach reply: {server session id,
  // server message id, words shown}. Keyed off the SEND RESPONSE's ids — never
  // render-time state — so the mask only ever applies to that exact message,
  // and only while the user is still viewing that session (render gate below).
  const [stream, setStream] = useState<{ sessionId: string; messageId: string; n: number } | null>(null)
  // Message ids that own(ed) their reveal — their container entrance (gf-co-in)
  // never plays/replays once the mask drops (package streamedRef, line 519).
  // Immutable state Set, not a ref: it is read during render (react-hooks/refs).
  const [streamedIds, setStreamedIds] = useState<ReadonlySet<string>>(() => new Set())
  // Send failures, keyed by session id (Mandated Adaptation 4): each session's
  // error row renders only inside that session, and one session's failure can
  // never clobber another's pending row (single-slot state lost the older
  // failure's content). Retry re-sends the stored content as a brand-new
  // request (backend rolled the failed turn back server-side, the hook rolled
  // back the optimistic bubble).
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({})
  // Which session the in-flight send belongs to: "Thinking" dots, chip hiding,
  // and the Stop button must not leak into OTHER sessions the user switches to
  // while a send is in flight (they'd get an interactive Stop for a turn that
  // isn't theirs). Sends stay globally serialized — see handleSend.
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null)
  const streamIvRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  // Stop pressed while the request is still in flight (Mandated Adaptation 3 —
  // the server persists the turn regardless, so Stop never aborts the request):
  // the reply commits instantly on arrival, with no reveal.
  const skipRevealRef = useRef(false)
  // Bumped on every user-initiated session switch (select / new-chat / delete
  // of the active session): a send that resolves under a stale token commits
  // straight to cache with no reveal — no zombie interval ticking behind a view
  // the user already left (package generation token, lines 517 + 574).
  const genTokenRef = useRef(0)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  // Scoped to the VIEWED session: drives the Stop button, Thinking dots, and
  // chip hiding. `busyElsewhere` still disables sending (one generation at a
  // time, package semantics) without rendering another session's indicators.
  const sendingHere = isSending && sendingSessionId === currentSessionId
  const streamingHere = stream != null && stream.sessionId === currentSessionId
  const generating = sendingHere || streamingHere
  const busyElsewhere = (isSending || stream != null) && !generating

  const isLoading = isListLoading || isSessionLoading
  const messages = useMemo(() => session?.messages ?? [], [session?.messages])
  const goalsById = useMemo(() => new Map(goals.map(g => [g.id, g])), [goals])

  useEffect(() => { document.title = 'Chat — GoalForge' }, [])

  // the reveal interval must not outlive the page
  useEffect(() => () => clearInterval(streamIvRef.current), [])

  // package feed-scroll effect (lines 532-534): also re-pins on every stream
  // tick so the growing reply stays glued to the bottom
  useEffect(() => {
    const f = feedRef.current
    if (f) f.scrollTo({ top: f.scrollHeight, behavior: 'smooth' })
  }, [currentSessionId, messages.length, sendingHere, stream])

  // last coach turn's chips drive the composer chip row (0-4 chips) — package
  // memo (line 527): hidden while THIS session's reply is in flight or still
  // revealing (chips pop only after the stream commits).
  const chips = useMemo(() => {
    if (!session || sendingHere || streamingHere) return []
    const last = session.messages[session.messages.length - 1]
    // cap at 3 — the model may return 4, and the row must stay a single line
    return last && last.role === 'coach' && last.chips ? last.chips.slice(0, 3) : []
  }, [session, sendingHere, streamingHere])

  // Daily-cap state: the header sub swaps to "Resting until tomorrow" when the
  // latest coach turn is the backend cap line (Mandated Adaptation 5).
  const lastCoach = useMemo(() => [...messages].reverse().find(m => m.role === 'coach'), [messages])
  const capped = !!lastCoach && isCapMessage(lastCoach.content)

  // Kill an active word-reveal: drop the mask (the message's full server
  // content is already in the cache underneath) and stop the interval.
  function cancelReveal() {
    if (streamIvRef.current !== undefined) {
      clearInterval(streamIvRef.current)
      streamIvRef.current = undefined
    }
    setStream(null)
  }

  function selectSession(id: string) {
    genTokenRef.current += 1
    cancelReveal()
    setActiveSessionId(id)
    setConfirmId(null)
    setDrawerOpen(false)
    setDraft('')
  }

  function newChat() {
    genTokenRef.current += 1
    cancelReveal()
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
      genTokenRef.current += 1
      cancelReveal()
      setActiveSessionId(remaining[0]?.id ?? null)
    }
    // a pending error row for the deleted session can never render again — drop it
    setSendErrors(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    setConfirmId(null)
    remove(id).catch(() => toast.error('Could not delete the chat. Please try again.'))
  }

  // Word-by-word reveal of a just-arrived live reply (package startStream,
  // lines 554-570; 48ms/word — the code value wins over NOTES' ~26ms). The full
  // content is already committed to the query cache — `stream` only masks it,
  // so stopping or finishing always lands on server truth (Adaptation 3).
  // Plan-card (`forged_goal_id`) and daily-cap replies pop complete with the
  // normal entrance instead: the package only ever streams plain live replies —
  // its rest branch structurally cannot stream (sanctioned inference).
  function beginReveal(sessionId: string, message: CoachMessage) {
    const skip = skipRevealRef.current
    skipRevealRef.current = false
    if (message.forged_goal_id || isCapMessage(message.content)) return
    // From here this message owns its reveal — suppress the gf-co-in container
    // entrance now and on every future render (no replay once the mask drops).
    setStreamedIds(prev => new Set(prev).add(message.id))
    if (skip) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const words = splitWords(message.content)
    if (words.length === 0) return
    setStream({ sessionId, messageId: message.id, n: 0 })
    let shown = 0
    streamIvRef.current = setInterval(() => {
      shown += 1
      // final tick commits (mask drops → full text, italics, plan card, actions)
      if (shown >= words.length) cancelReveal()
      else setStream({ sessionId, messageId: message.id, n: shown })
    }, 48)
  }

  // Full send cycle: create-if-needed → send → reveal. Never touches the draft —
  // handleSend clears it up-front for composer sends, and Retry re-sends stored
  // content while the user may already be typing something new.
  async function performSend(sessionId: string | null, content: string) {
    skipRevealRef.current = false
    const token = genTokenRef.current
    let sid = sessionId
    if (!sid) {
      // Lazy create (PR 1): sending from the new-chat empty state creates the
      // session first, then sends into it. Failing HERE leaves no thread to
      // host the error row, so this path keeps the draft-restore + toast.
      try {
        const created = await create()
        setActiveSessionId(created.id)
        sid = created.id
      } catch {
        setDraft(content)
        toast.error('Could not start the chat. Please try again.')
        return
      }
    }
    setSendingSessionId(sid)
    try {
      const data = await send({ sessionId: sid, content })
      // clear a resolved failure for THIS session only — an unrelated
      // session's pending error row must survive
      setSendErrors(prev => {
        if (!(sid in prev)) return prev
        const next = { ...prev }
        delete next[sid]
        return next
      })
      // stale token = the user switched sessions mid-flight: the reply is
      // already committed to cache; skip the reveal so no stream ever runs
      // behind a view the user left
      if (genTokenRef.current === token) {
        const reply = data.session.messages[data.session.messages.length - 1]
        if (reply && reply.role === 'coach') beginReveal(data.session.id, reply)
      }
    } catch {
      // Mandated Adaptation 4: the hook already rolled the optimistic bubble
      // back (and the backend rolled back the turn); the inline error row owns
      // recovery — no toast, and the draft stays cleared.
      setSendErrors(prev => ({ ...prev, [sid]: content }))
    } finally {
      setSendingSessionId(null)
    }
  }

  function handleSend(text: string) {
    // global single-generation guard (package semantics): sends are blocked
    // while ANY session's turn is in flight or revealing, even though only the
    // owning session renders indicators
    if (!userId || isSending || stream != null || isCreating) return
    const content = text.trim()
    if (!content) return
    // Clear the composer immediately — the message optimistically appears in
    // the thread (useSendCoachMessageMutation.onMutate).
    setDraft('')
    void performSend(currentSessionId, content)
  }

  // Stop (Mandated Adaptation 3): the server persists the turn regardless, so
  // Stop never aborts the request — it only suppresses the reveal theater.
  function stop() {
    if (isSending) {
      skipRevealRef.current = true
      return
    }
    // Mid-reveal: dropping the mask commits the FULL server text at once (the
    // package's partial-text freeze would contradict server truth).
    cancelReveal()
  }

  function retry() {
    if (!userId || isSending || stream != null || isCreating || !currentSessionId) return
    const content = sendErrors[currentSessionId]
    if (!content) return
    void performSend(currentSessionId, content)
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
    onSend: handleSend,
    chips,
    onChip: c => setDraft(c),
    generating,
    busyElsewhere,
    onStop: stop,
    taRef,
    usage,
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
              resetLabel={usage ? resetTimeLabel(usage.resets_at) : null}
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
                    // stream mask only for the exact server message, and only
                    // while the user is still viewing the session it landed in
                    const streamN = stream && stream.sessionId === currentSessionId && stream.messageId === m.id
                      ? stream.n
                      : null
                    return (
                      <CoachMsg
                        key={m.id}
                        content={m.content}
                        animate={isLast && !streamedIds.has(m.id)}
                        rest={isCapMessage(m.content)}
                        goal={goal}
                        streamN={streamN}
                        onRefine={() => {
                          // visible reaction, not just a focus ring: seed the ask
                          // so the user only has to describe the change
                          setDraft(d => d || "Let's refine this plan: ")
                          taRef.current?.focus()
                        }}
                      />
                    )
                  })}
                  {sendingHere && <TypingDots />}
                  {/* package error row (lines 650-656), session-keyed local state
                      instead of session.error (Mandated Adaptation 4) */}
                  {currentSessionId && sendErrors[currentSessionId] && !generating && (
                    <div className="gf-co-error">
                      <Icon name="alert" size={16} className="gf-co-error-ic" />
                      <span className="gf-co-error-t">Something went wrong. Try again.</span>
                      <button className="gf-co-retry" onClick={retry} disabled={busyElsewhere}><Icon name="retry" size={13} /> Retry</button>
                    </div>
                  )}
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
