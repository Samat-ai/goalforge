import { useEffect, useMemo, useState } from 'react'
import { useT } from '../lib/theme'
import { pickOneThing } from '../lib/pickOneThing'
import type { Goal } from '../lib/types'

const DONE_MESSAGES = [
  'Momentum is built one thing at a time.',
  "That's all it takes. One thing.",
  'You showed up. That counts.',
  'Small steps. Real progress.',
  "One down. You're already winning.",
]

type Phase = 'focus' | 'done'

interface FocusOverlayProps {
  goals: Goal[]
  completeTask: (taskId: string) => void
  isOpen: boolean
  onClose: () => void
}

const OVERLAY_STYLE = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 1000,
  background: 'rgba(7, 7, 15, 0.97)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
}

export default function FocusOverlay({ goals, completeTask, isOpen, onClose }: FocusOverlayProps) {
  const T = useT()
  const [phase, setPhase] = useState<Phase>('focus')
  const [doneMessage, setDoneMessage] = useState('')
  const [completing, setCompleting] = useState(false)

  // Recomputes whenever goals cache updates. Becomes null after completeTask fires.
  const focusItem = useMemo(() => pickOneThing(goals), [goals])

  // Graceful close: task disappeared while user was in focus phase (e.g. background refetch
  // from another tab completed the task). Not triggered after handleComplete because by then
  // phase === 'done', not 'focus'.
  useEffect(() => {
    if (isOpen && phase === 'focus' && focusItem === null) {
      onClose()
    }
  }, [isOpen, phase, focusItem, onClose])

  // Escape key closes in focus phase only (in done phase, user must click Back to Dashboard)
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && phase === 'focus') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, phase, onClose])

  if (!isOpen) return null

  // ── Done phase — check BEFORE focusItem null-guard (focusItem is null in done phase) ──
  if (phase === 'done') {
    return (
      <div role="dialog" aria-modal="true" aria-label="Task complete" style={OVERLAY_STYLE}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            maxWidth: 360,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 56, lineHeight: 1 }}>⭐</div>

          <div style={{ fontFamily: T.serif, fontSize: 28, color: T.text }}>+10 Star Points</div>

          <div
            style={{
              fontSize: 14,
              color: T.textDim,
              fontFamily: T.serif,
              fontStyle: 'italic',
              lineHeight: 1.7,
            }}
          >
            {doneMessage}
          </div>

          <button
            onClick={onClose}
            style={{
              marginTop: 8,
              minHeight: 48,
              padding: '12px 32px',
              borderRadius: 10,
              background: `${T.indigo}18`,
              color: T.indigo,
              border: `1px solid ${T.indigo}40`,
              cursor: 'pointer',
              fontFamily: T.mono,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Focus phase needs a task ──
  if (focusItem === null) return null

  const { task, goal, milestone } = focusItem

  function handleComplete() {
    if (completing) return
    setCompleting(true)
    // Pick message in event handler (not render) to satisfy ESLint impure-render rule
    const msg = DONE_MESSAGES[Math.floor(Math.random() * DONE_MESSAGES.length)]
    setDoneMessage(msg)
    // completeTask fires onMutate synchronously: optimistic cache update + toast + confetti
    completeTask(task.id)
    // Transition AFTER completeTask so phase === 'done' by the time React re-renders,
    // preventing the focusItem-null guard from closing the overlay prematurely.
    setPhase('done')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Focus mode"
      style={OVERLAY_STYLE}
      // Backdrop click intentionally does nothing — this is the "safe room" behavior.
      // Users must use the explicit exit button or Escape key.
    >
      {/* Exit — top right */}
      <button
        onClick={onClose}
        aria-label="Exit focus mode"
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: T.muted,
          fontSize: 11,
          fontFamily: T.mono,
          minHeight: 44,
          minWidth: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        ✕ Exit Focus
      </button>

      {/* Task card */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.indigo}33`,
          borderRadius: 16,
          padding: '32px 28px',
          maxWidth: 480,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: `0 0 60px ${T.indigo}15`,
        }}
      >
        {/* Context: Goal Title + Sprint Theme */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, color: T.text, fontFamily: T.serif, fontWeight: 600 }}>
            {goal.smart_title}
          </div>
          {milestone.sprint_theme && (
            <div
              style={{
                fontSize: 10,
                color: T.indigo,
                fontFamily: T.mono,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {milestone.sprint_theme}
            </div>
          )}
        </div>

        {/* Label */}
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.muted,
            fontFamily: T.mono,
          }}
        >
          Your one thing right now
        </div>

        {/* Task description */}
        <div
          style={{
            fontSize: 18,
            color: T.text,
            fontFamily: T.serif,
            lineHeight: 1.65,
          }}
        >
          {task.description}
        </div>

        {/* Tip — only if present */}
        {task.tip && (
          <div
            style={{
              fontSize: 12,
              color: T.textDim,
              fontFamily: T.serif,
              fontStyle: 'italic',
              lineHeight: 1.6,
            }}
          >
            "{task.tip}"
          </div>
        )}

        {/* Complete button */}
        <button
          onClick={handleComplete}
          disabled={completing}
          style={{
            marginTop: 8,
            minHeight: 48,
            padding: '13px 20px',
            borderRadius: 10,
            background: T.indigo,
            color: '#fff',
            border: 'none',
            cursor: completing ? 'not-allowed' : 'pointer',
            fontFamily: T.mono,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            width: '100%',
            opacity: completing ? 0.6 : 1,
          }}
        >
          Mark Complete +10 ⭐
        </button>
      </div>
    </div>
  )
}
