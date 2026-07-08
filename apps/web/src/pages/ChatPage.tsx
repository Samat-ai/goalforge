// pages/ChatPage.tsx — Chat (Coach) page: real AI intake session over the
// prototype's chat visuals. Transcribed from design_handoff_goalforge/app/gf-coach.jsx.
//
// IMPORTANT: the prototype's `Coach` component runs a fully scripted, client-only
// INTAKE sequence (canned questions/chips per step, fake `setTimeout` typing delays,
// a hardcoded FORGED plan). None of that scripted behavior is ported — only its
// *visuals* (message bubbles, typing indicator, suggestion chips, composer, empty
// state, progress segments, plan card). The actual session state comes from the
// real backend via useCoachSessionQuery / useStartCoachSessionMutation /
// useSendCoachMessageMutation (see src/hooks/useCoach.ts): the backend drives the
// question sequence, and after 5 answers it synchronously creates the Goal.
// Post-creation navigation (Link to /dashboard) is lifted from the legacy
// src/pages/Coach.tsx (behavior only, not markup).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useUser } from '@clerk/react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '../components/gf/Ui'
import { cx } from '../components/gf/util'
import SollyIdle from '../components/SollyIdle'
import { CoachPanelSkeleton } from '../components/ui/Skeleton'
import { useCoachSessionQuery, useSendCoachMessageMutation, useStartCoachSessionMutation } from '../hooks'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

const TOTAL_INTAKE_QUESTIONS = 5

// Starter chips shown only for the very first question (answeredCount === 0) —
// the prototype swaps these per scripted intake step, but the real flow has no
// per-step chip data from the backend, so this static set (matching the
// prototype's first question) acts purely as conversation starters and hides
// once the user has answered. AI-generated per-turn chips are deferred.
const SUGGESTION_CHIPS = [
  'Get fit & run regularly',
  'Launch a side project',
  'Read more books',
  'Learn a language',
]

const STARTER_PROMPTS = ['I want to get fit', 'Help me finish my side project', 'Build a daily reading habit', 'I keep procrastinating']

// minimal *italic* -> <em> for non-streamed messages
function renderItalics(text: string): ReactNode[] {
  return text.split(/(\*[^*]+\*)/g).filter(Boolean).map((seg, i) =>
    seg.length > 1 && seg.startsWith('*') && seg.endsWith('*')
      ? <em key={i}>{seg.slice(1, -1)}</em>
      : <span key={i}>{seg}</span>,
  )
}

// Reveals a coach reply word-by-word, each word softly fading in (ChatGPT-style).
// Visual only — mirrors gf-coach.jsx's local StreamingText.
function StreamingText({ content, onTick }: { content: string; onTick?: () => void }) {
  const words = (() => {
    const out: { t: string; italic: boolean }[] = []
    for (const seg of content.split(/(\*[^*]+\*)/g)) {
      if (!seg) continue
      const italic = seg.length > 1 && seg.startsWith('*') && seg.endsWith('*')
      const text = italic ? seg.slice(1, -1) : seg
      for (const t of text.match(/\S+\s*/g) ?? []) out.push({ t, italic })
    }
    return out
  })()
  const [count, setCount] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setCount(words.length); onTick?.(); return }
    setCount(0)
    let i = 0
    const id = setInterval(() => {
      i += 1
      setCount(i)
      onTick?.()
      if (i >= words.length) clearInterval(id)
    }, 42)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])
  return (
    <span className="gf-co-stream">
      {words.slice(0, count).map((w, idx) => w.italic
        ? <em key={idx} className="gf-co-word">{w.t}</em>
        : <span key={idx} className="gf-co-word">{w.t}</span>)}
    </span>
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

function CoachMsg({ content, animate, stream, onTick }: { content: string; animate: boolean; stream: boolean; onTick: () => void }) {
  // Per-message action row (prototype: gf-coach.jsx CoachMsg). The prototype's
  // buttons are inert; real minimal behavior here — Copy writes the message to
  // the clipboard, Good records a local transient acknowledgement (no backend
  // feedback endpoint exists, so none is invented).
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
  return (
    <div className={cx('gf-co-msg gf-co-assistant', animate && !stream && 'gf-co-in')}>
      <div className="gf-co-text">
        {stream ? <StreamingText content={content} onTick={onTick} /> : renderItalics(content)}
      </div>
      <div className="gf-co-actions">
        <button className="gf-co-act" aria-label={acked === 'copy' ? 'Copied' : 'Copy'} onClick={copy}><Icon name="check" size={14} /></button>
        <button className="gf-co-act" aria-label={acked === 'good' ? 'Thanks for the feedback' : 'Good'} onClick={() => ack('good')}><Icon name="spark" size={14} /></button>
      </div>
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

export default function ChatPage() {
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)

  const { session, isLoading } = useCoachSessionQuery(userId)
  const { start, isStarting } = useStartCoachSessionMutation(userId ?? '')
  const { send, isSending, result } = useSendCoachMessageMutation(userId ?? '')

  const [draft, setDraft] = useState('')
  const [streamId, setStreamId] = useState<string | null>(null)
  const [isStartingWithPrompt, setIsStartingWithPrompt] = useState(false)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const prevLenRef = useRef(0)

  const messages = useMemo(() => session?.messages ?? [], [session?.messages])
  const answeredCount = messages.filter(m => m.role === 'user').length
  const forgedGoal = result?.forged_goal ?? null
  const isCompleted = !!session?.is_completed

  useEffect(() => { document.title = 'Chat — GoalForge' }, [])

  const scrollFeed = () => {
    const f = feedRef.current
    if (f) f.scrollTo({ top: f.scrollHeight, behavior: 'smooth' })
  }
  useEffect(() => { scrollFeed() }, [messages.length, isSending, isCompleted])

  // Stream the newest coach reply word-by-word when it arrives.
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      const last = messages[messages.length - 1]
      if (last && last.role === 'coach') setStreamId(last.id)
    }
    prevLenRef.current = messages.length
  }, [messages.length, messages])

  async function handleStart() {
    if (!userId || isStarting) return
    try { await start() } catch { toast.error('Could not start coach session. Please try again.') }
  }

  async function handleStartWithPrompt(prompt: string) {
    if (!userId || isStarting || isStartingWithPrompt) return
    setIsStartingWithPrompt(true)
    try {
      const startedSession = await start()
      await send({ sessionId: startedSession.id, content: prompt })
    } catch {
      toast.error('Could not start coach session. Please try again.')
    } finally {
      setIsStartingWithPrompt(false)
    }
  }

  async function handleSend() {
    if (!session || !userId || isSending || isStarting || session.is_completed) return
    const content = draft.trim()
    if (!content) return
    // Clear the composer immediately — the message optimistically appears in
    // the thread (useSendCoachMessageMutation.onMutate); restore on failure.
    setDraft('')
    if (taRef.current) taRef.current.style.height = 'auto'
    try {
      await send({ sessionId: session.id, content })
    } catch {
      setDraft(content)
      toast.error('Coach message failed. Please retry.')
    }
  }

  function grow(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="gf-page gf-chat">
      {isLoading ? (
        <div className="py-6"><CoachPanelSkeleton /></div>
      ) : (
        <div className="gf-co-shell">
          {session && (
            <div className="gf-co-head">
              <div className="gf-co-head-l">
                <div className="gf-co-av">
                  <img src="/solly/solly.png" alt="Solly" className="gf-co-solly" width={34} height={34} />
                </div>
                <div>
                  <div className="gf-co-head-title">Chat</div>
                  <div className="gf-co-head-sub">
                    {isCompleted
                      ? 'Plan forged · ready to go'
                      : `Intake · question ${Math.min(answeredCount + 1, TOTAL_INTAKE_QUESTIONS)} of ${TOTAL_INTAKE_QUESTIONS}`}
                  </div>
                </div>
              </div>
              <div className="gf-co-prog" aria-label={`Progress ${answeredCount} of ${TOTAL_INTAKE_QUESTIONS}`}>
                {Array.from({ length: TOTAL_INTAKE_QUESTIONS }, (_, i) => (
                  <span key={i} className={cx('gf-co-prog-seg', i < answeredCount && 'is-done', i === answeredCount && !isCompleted && 'is-cur')} />
                ))}
              </div>
            </div>
          )}

          <div className="gf-co-feed" ref={feedRef}>
            {!session ? (
              <div className="gf-co-empty">
                <div className="gf-co-empty-av"><SollyIdle className="gf-co-solly-lg" /></div>
                <h2 className="gf-co-empty-title">{"Let's forge your next goal"}</h2>
                <p className="gf-co-empty-sub">
                  Answer five quick questions and I'll turn your real constraints and motivation into a
                  personalized SMART goal — with sprint milestones and your first week of tasks. Not a motivational speech.
                </p>
                <div className="gf-co-starters">
                  {STARTER_PROMPTS.map(s => (
                    <button
                      key={s}
                      className="gf-co-starter"
                      onClick={() => { void handleStartWithPrompt(s) }}
                      disabled={isStarting || isStartingWithPrompt}
                    >
                      <Icon name="spark" size={14} /> {s}
                    </button>
                  ))}
                </div>
                <button className="gf-btn gf-btn-accent gf-co-startbtn" onClick={() => { void handleStart() }} disabled={isStarting || isStartingWithPrompt}>
                  {isStarting || isStartingWithPrompt ? 'Starting…' : 'Start coaching session'} <Icon name="arrowRight" size={15} />
                </button>
              </div>
            ) : (
              <div className="gf-co-thread">
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1
                  if (m.role === 'user') {
                    return <UserMsg key={m.id} content={m.content} animate={isLast} />
                  }
                  const stream = isLast && m.id === streamId
                  return (
                    <CoachMsg key={m.id} content={m.content} animate={isLast} stream={stream} onTick={scrollFeed} />
                  )
                })}
                {isSending && <TypingDots />}
                {(isCompleted || forgedGoal) && (
                  <div className="gf-co-msg gf-co-assistant gf-co-in">
                    <div className="gf-co-plan">
                      <div className="gf-co-plan-glow" />
                      <div className="gf-co-plan-cap"><Icon name="spark" size={12} /> Plan forged · your SMART goal</div>
                      <h3 className="gf-co-plan-title">{forgedGoal?.smart_title ?? 'Your personalized goal has been forged.'}</h3>
                      {forgedGoal?.smart_description && <p className="gf-co-plan-desc">{forgedGoal.smart_description}</p>}
                      {forgedGoal && (forgedGoal.milestones?.length || forgedGoal.daily_tasks?.length) ? (
                        <div className="gf-co-plan-grid">
                          {forgedGoal.milestones?.length ? (
                            <div>
                              <div className="gf-co-plan-h">Sprint milestones</div>
                              <ul className="gf-co-plan-list">
                                {forgedGoal.milestones.map((ms, i) => (
                                  <li key={ms.id}><span className="gf-co-dot">{i + 1}</span>{ms.title}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {forgedGoal.daily_tasks?.length ? (
                            <div>
                              <div className="gf-co-plan-h">Your first tasks</div>
                              <ul className="gf-co-plan-list">
                                {forgedGoal.daily_tasks.slice(0, 3).map(t => (
                                  <li key={t.id}><span className="gf-co-tick"><Icon name="check" size={11} stroke={3} /></span>{t.description}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="gf-co-plan-foot">
                        <Link to="/dashboard" className="gf-btn gf-btn-accent">Open Dashboard <Icon name="arrowRight" size={14} /></Link>
                        {/* Prototype's second footer button (gf-coach.jsx PlanCard). Real
                            minimal behavior: focus the composer to continue the conversation
                            (safe no-op when the composer is hidden on completed sessions). */}
                        <button className="gf-btn gf-btn-soft" onClick={() => taRef.current?.focus()}>Refine plan</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {session && !isCompleted && (
            <div className="gf-co-composer">
              {draft === '' && answeredCount === 0 && (
                <div className="gf-co-chips">
                  {SUGGESTION_CHIPS.map(chip => (
                    <button
                      key={chip}
                      className="gf-co-chip"
                      onClick={() => {
                        setDraft(chip)
                        taRef.current?.focus()
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
              <div className="gf-co-inputbar">
                <textarea
                  ref={taRef}
                  className="gf-co-input"
                  rows={1}
                  placeholder="Answer with concrete details…"
                  aria-label="Your answer"
                  value={draft}
                  onChange={grow}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
                />
                <button
                  className={cx('gf-co-send', draft.trim() && 'is-on')}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { void handleSend() }}
                  aria-label="Send"
                  disabled={!draft.trim() || isSending || isStarting}
                >
                  <Icon name="arrowUp" size={18} stroke={2.4} />
                </button>
              </div>
              <div className="gf-co-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
