import { useEffect, useMemo, useState } from 'react'
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
  const [phase, setPhase] = useState<Phase>('focus')
  const [doneMessage, setDoneMessage] = useState('')
  const [completing, setCompleting] = useState(false)

  const focusItem = useMemo(() => pickOneThing(goals), [goals])

  useEffect(() => {
    if (isOpen && phase === 'focus' && focusItem === null) onClose()
  }, [isOpen, phase, focusItem, onClose])

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && phase === 'focus') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, phase, onClose])

  if (!isOpen) return null

  if (phase === 'done') {
    return (
      <div role="dialog" aria-modal="true" aria-label="Task complete" style={OVERLAY_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>⭐</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text)' }}>+10 Star Points</div>
          <div style={{ fontSize: 14, color: 'var(--text-dim)', fontFamily: 'var(--font-display)', fontStyle: 'italic', lineHeight: 1.7 }}>
            {doneMessage}
          </div>
          <button
            onClick={onClose}
            style={{
              marginTop: 8, minHeight: 48, padding: '12px 32px', borderRadius: 10,
              background: 'color-mix(in oklab, var(--indigo) 18%, transparent)',
              color: 'var(--indigo)',
              border: '1px solid color-mix(in oklab, var(--indigo) 40%, transparent)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (focusItem === null) return null

  const { task, goal, milestone } = focusItem

  function handleComplete() {
    if (completing) return
    setCompleting(true)
    const msg = DONE_MESSAGES[Math.floor(Math.random() * DONE_MESSAGES.length)]
    setDoneMessage(msg)
    completeTask(task.id)
    setPhase('done')
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Focus mode" style={OVERLAY_STYLE}>
      <button
        onClick={onClose}
        aria-label="Exit focus mode"
        style={{
          position: 'absolute', top: 16, right: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-mute)', fontSize: 11, fontFamily: 'var(--font-mono)',
          minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        }}
      >
        ✕ Exit Focus
      </button>

      <div
        style={{
          background: 'var(--card)',
          border: '1px solid color-mix(in oklab, var(--indigo) 20%, transparent)',
          borderRadius: 16, padding: '32px 28px', maxWidth: 480, width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 0 60px color-mix(in oklab, var(--indigo) 10%, transparent)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            {goal.smart_title}
          </div>
          {milestone.sprint_theme && (
            <div style={{ fontSize: 10, color: 'var(--indigo)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {milestone.sprint_theme}
            </div>
          )}
        </div>

        <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
          Your one thing right now
        </div>

        <div style={{ fontSize: 18, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 1.65 }}>
          {task.description}
        </div>

        {task.tip && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-display)', fontStyle: 'italic', lineHeight: 1.6 }}>
            &quot;{task.tip}&quot;
          </div>
        )}

        <button
          onClick={handleComplete}
          disabled={completing}
          style={{
            marginTop: 8, minHeight: 48, padding: '13px 20px', borderRadius: 10,
            background: 'var(--indigo)', color: '#fff', border: 'none',
            cursor: completing ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
            width: '100%', opacity: completing ? 0.6 : 1,
          }}
        >
          Mark Complete +10 ⭐
        </button>
      </div>
    </div>
  )
}
