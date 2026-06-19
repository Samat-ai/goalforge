import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useUser } from '@clerk/react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Icon from '../components/ui/Icon'
import SollyIdle from '../components/SollyIdle'
import StreamingText from '../components/StreamingText'
import { CoachPanelSkeleton } from '../components/ui/Skeleton'
import { useCoachSessionQuery, useSendCoachMessageMutation, useStartCoachSessionMutation } from '../hooks'

const TOTAL_INTAKE_QUESTIONS = 5
const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

// minimal *italic* -> <em> for non-streamed messages
function renderItalics(text: string): ReactNode[] {
  return text.split(/(\*[^*]+\*)/g).filter(Boolean).map((seg, i) =>
    seg.length > 1 && seg.startsWith('*') && seg.endsWith('*')
      ? <em key={i}>{seg.slice(1, -1)}</em>
      : <span key={i}>{seg}</span>,
  )
}

function TypingDots() {
  return (
    <div className="gf-co-msg gf-co-assistant gf-co-think">
      <span className="gf-think-pulse" role="status" aria-label="Thinking"><i /><span>Thinking</span></span>
    </div>
  )
}

export default function Coach() {
  const { user } = useUser()
  const userId = user?.id

  const { session, isLoading } = useCoachSessionQuery(userId)
  const { start, isStarting } = useStartCoachSessionMutation(userId ?? '')
  const { send, isSending, result } = useSendCoachMessageMutation(userId ?? '')

  const [draft, setDraft] = useState('')
  const [streamId, setStreamId] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const prevLenRef = useRef(0)

  const messages = session?.messages ?? []
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
  }, [messages.length])

  async function handleStart() {
    if (!userId || isStarting) return
    try { await start() } catch { toast.error('Could not start coach session. Please try again.') }
  }

  async function handleSend() {
    if (!session || !userId || isSending || isStarting || session.is_completed) return
    const content = draft.trim()
    if (!content) return
    try {
      await send({ sessionId: session.id, content })
      setDraft('')
      if (taRef.current) taRef.current.style.height = 'auto'
    } catch { toast.error('Coach message failed. Please retry.') }
  }

  function grow(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="min-h-dvh mesh-bg">

      <main id="main-content" className="gf-main gf-coach">
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
                  <h2 className="gf-co-empty-title">Let's forge your next goal</h2>
                  <p className="gf-co-empty-sub">
                    Answer five quick questions and I'll turn your real constraints and motivation into a
                    personalized SMART goal — with sprint milestones and your first week of tasks. Not a motivational speech.
                  </p>
                  <button className="gf-btn gf-btn-accent gf-co-startbtn" onClick={() => { void handleStart() }} disabled={isStarting}>
                    {isStarting ? 'Starting…' : 'Start coaching session'} <Icon name="arrowUp" size={15} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                </div>
              ) : (
                <div className="gf-co-thread">
                  {messages.map((m, i) => {
                    const isLast = i === messages.length - 1
                    if (m.role === 'user') {
                      return (
                        <div key={m.id} className={cx('gf-co-msg gf-co-user', isLast && 'gf-co-in')}>
                          <div className="gf-co-userbub">{m.content}</div>
                        </div>
                      )
                    }
                    const stream = isLast && m.id === streamId
                    return (
                      <div key={m.id} className={cx('gf-co-msg gf-co-assistant', isLast && !stream && 'gf-co-in')}>
                        <div className="gf-co-text">
                          {stream ? <StreamingText content={m.content} onTick={scrollFeed} /> : renderItalics(m.content)}
                        </div>
                      </div>
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
                                  {forgedGoal.milestones.map((m, i) => (
                                    <li key={m.id}><span className="gf-co-dot">{i + 1}</span>{m.title}</li>
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
                          <Link to="/dashboard" className="gf-btn gf-btn-accent">Open Dashboard <Icon name="arrowUp" size={14} style={{ transform: 'rotate(90deg)' }} /></Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {session && !isCompleted && (
              <div className="gf-co-composer">
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
      </main>
    </div>
  )
}
