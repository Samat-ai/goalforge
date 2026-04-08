import { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import { T } from '../lib/theme'
import { CoachPanelSkeleton } from '../components/ui/Skeleton'
import { useCoachSessionQuery, useProfileQuery, useSendCoachMessageMutation, useStartCoachSessionMutation } from '../hooks'
import UpgradePrompt from '../components/UpgradePrompt'
import { useUpgradePrompt } from '../hooks/useUpgradePrompt'

const TOTAL_INTAKE_QUESTIONS = 5

export default function Coach() {
  const { user } = useUser()
  const userId = user?.id

  const { pts } = useProfileQuery(userId)
  const { session, isLoading } = useCoachSessionQuery(userId)
  const { start, isStarting } = useStartCoachSessionMutation(userId ?? '')
  const { send, isSending, result } = useSendCoachMessageMutation(userId ?? '')

  const [draft, setDraft] = useState('')
  const feedRef = useRef<HTMLDivElement | null>(null)

  const { activeFeature, showUpgrade, hideUpgrade } = useUpgradePrompt()

  // Free plan: hard-coded to 'free' until billing integration exists.
  const plan = 'free'

  const answeredCount = session ? session.messages.filter(m => m.role === 'user').length : 0
  const progressPct = Math.min(100, Math.round((answeredCount / TOTAL_INTAKE_QUESTIONS) * 100))
  const forgedGoal = result?.forged_goal

  useEffect(() => {
    document.title = 'Coach Forge - GoalForge'
  }, [])

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [session?.messages.length])

  async function handleStart() {
    if (!userId || isStarting) return
    try {
      await start()
    } catch {
      toast.error('Could not start coach session. Please try again.')
    }
  }

  async function handleSend() {
    if (!session || !userId || isSending || isStarting || session.is_completed) return
    const content = draft.trim()
    if (!content) return

    try {
      await send({ sessionId: session.id, content })
      setDraft('')
    } catch {
      toast.error('Coach message failed. Please retry.')
    }
  }

  return (
    <div className="mesh-bg" style={{ minHeight: '100dvh', background: T.bg, color: T.text, fontFamily: T.mono }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.dim}; border-radius: 2px; }
      `}</style>

      <AppHeader pts={pts} />

      <main id="main-content" style={{ maxWidth: 1120, margin: '0 auto' }} className="px-4 py-5 sm:px-8 sm:py-7">
        <section style={{
          marginBottom: 16,
          borderRadius: 14,
          border: `1px solid ${T.indigo}45`,
          background: `linear-gradient(135deg, ${T.card}, #101a2f)`,
          padding: '16px 18px',
        }}>
          <div style={{ fontFamily: T.mono, color: T.muted, fontSize: 10, letterSpacing: '0.12em', marginBottom: 8 }}>
            COACH FORGE
          </div>
          <h1 style={{ fontFamily: T.serif, fontWeight: 500, fontSize: 30, lineHeight: 1.2, marginBottom: 8 }}>
            Personalized AI Coach, Not Generic Advice
          </h1>
          <p style={{ color: T.textDim, fontSize: 13, lineHeight: 1.7, maxWidth: 780 }}>
            Answer five focused questions. Coach Forge will convert your real constraints and motivations into
            a personalized SMART goal with sprint milestones and your first 7-day task sequence.
          </p>
        </section>

        {isLoading && <CoachPanelSkeleton />}

        {!session && !isLoading && (
          <section style={{
            borderRadius: 14,
            border: `1px solid ${T.borderHi}`,
            background: T.card,
            padding: '16px 18px',
          }}>
            <div style={{ fontFamily: T.serif, fontSize: 20, marginBottom: 8 }}>Ready to Forge?</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim, marginBottom: 14 }}>
              You will get a real plan, not a motivational speech.
            </div>
            <button
              onClick={() => {
                if (plan === 'free') {
                  showUpgrade('coaching')
                  return
                }
                void handleStart()
              }}
              disabled={isStarting}
              style={{
                minHeight: 44,
                minWidth: 44,
                borderRadius: 8,
                border: `1px solid ${T.indigo}55`,
                background: `${T.indigo}22`,
                color: T.indigo,
                padding: '0 16px',
                cursor: isStarting ? 'wait' : 'pointer',
                fontFamily: T.mono,
                fontSize: 12,
                letterSpacing: '0.05em',
              }}
            >
              {isStarting ? 'Starting...' : 'Start Coach Session'}
            </button>
          </section>
        )}

        {session && (
          <section style={{
            borderRadius: 14,
            border: `1px solid ${T.border}`,
            background: T.card,
            overflow: 'hidden',
          }}>
            <div style={{
              borderBottom: `1px solid ${T.border}`,
              background: T.surface,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
                Intake Progress: {Math.min(answeredCount, TOTAL_INTAKE_QUESTIONS)}/{TOTAL_INTAKE_QUESTIONS}
              </div>
              <div style={{ height: 6, borderRadius: 99, background: T.dim, width: 180, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: T.indigo }} />
              </div>
              <div style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 10, color: session.is_completed ? T.emerald : T.amber }}>
                {session.is_completed ? 'GOAL FORGED' : 'COACHING LIVE'}
              </div>
            </div>

            <div
              ref={feedRef}
              style={{
                maxHeight: 440,
                overflowY: 'auto',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {session.messages.map(message => (
                <article
                  key={message.id}
                  style={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    width: 'min(88%, 760px)',
                    borderRadius: 12,
                    border: `1px solid ${message.role === 'user' ? `${T.indigo}50` : T.border}`,
                    background: message.role === 'user' ? `${T.indigo}1f` : T.surface,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: message.role === 'user' ? T.indigo : T.muted, marginBottom: 4 }}>
                    {message.role === 'user' ? 'YOU' : 'COACH'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: T.serif, fontSize: 15, lineHeight: 1.6 }}>
                    {message.content}
                  </div>
                </article>
              ))}
            </div>

            {!session.is_completed && (
              <div style={{ borderTop: `1px solid ${T.border}`, background: '#0c1020', padding: 12 }}>
                <div style={{
                  border: `1px solid ${T.borderHi}`,
                  borderRadius: 12,
                  background: '#090f1f',
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    placeholder="Answer with concrete details. Ctrl/Cmd+Enter to send."
                    rows={3}
                    style={{
                      width: '100%',
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      background: T.surface,
                      color: T.text,
                      padding: '10px 12px',
                      fontFamily: T.mono,
                      fontSize: 13,
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>
                      Keep it honest. The plan quality depends on answer quality.
                    </div>
                    <button
                      onClick={() => { void handleSend() }}
                      disabled={isSending || isStarting || !draft.trim()}
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        borderRadius: 8,
                        border: `1px solid ${T.emerald}50`,
                        background: `${T.emerald}1f`,
                        color: T.emerald,
                        padding: '0 16px',
                        cursor: isSending ? 'wait' : 'pointer',
                        opacity: isSending || isStarting || !draft.trim() ? 0.55 : 1,
                        fontFamily: T.mono,
                        fontSize: 12,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {(session?.is_completed || forgedGoal) && (
          <section style={{
            marginTop: 14,
            borderRadius: 14,
            border: `1px solid ${T.emerald}40`,
            background: `${T.emerald}10`,
            padding: '14px 16px',
          }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.emerald, letterSpacing: '0.1em', marginBottom: 6 }}>
              PLAN READY
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 18, marginBottom: 8 }}>
              {forgedGoal ? forgedGoal.smart_title : 'Your personalized goal has been forged.'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link
                to="/dashboard"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  borderRadius: 8,
                  border: `1px solid ${T.emerald}55`,
                  background: `${T.emerald}1f`,
                  color: T.emerald,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: '0.05em',
                }}
              >
                Open Dashboard
              </Link>
            </div>
          </section>
        )}
      </main>

      {activeFeature && (
        <UpgradePrompt
          variant="modal"
          feature={activeFeature}
          onClose={hideUpgrade}
        />
      )}
    </div>
  )
}
