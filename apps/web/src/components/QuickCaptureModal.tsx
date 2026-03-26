import { useMemo, useState } from 'react'
import { T } from '../lib/theme'
import type { Goal } from '../lib/types'

interface QuickCaptureModalProps {
  isOpen: boolean
  goals: Goal[]
  onClose: () => void
  onAddGoal: (rawInput: string) => Promise<void>
  onAddTask: (goalId: string, milestoneId: string | null, description: string) => Promise<void>
}

type CaptureMode = 'goal' | 'task'

export default function QuickCaptureModal({
  isOpen,
  goals,
  onClose,
  onAddGoal,
  onAddTask,
}: QuickCaptureModalProps) {
  const [mode, setMode] = useState<CaptureMode>('goal')
  const [text, setText] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeGoals = useMemo(
    () => goals.filter(g => g.status === 'active'),
    [goals],
  )
  const fallbackGoal = activeGoals[0] ?? null
  const selectedGoal = activeGoals.find(g => g.id === selectedGoalId) ?? fallbackGoal
  const activeMilestoneId = selectedGoal?.milestones.find(m => m.sprint_status === 'active')?.id ?? null

  if (!isOpen) return null

  async function submit() {
    const value = text.trim()
    if (!value || submitting) return

    setSubmitting(true)
    try {
      if (mode === 'goal') {
        await onAddGoal(value)
      } else if (selectedGoal) {
        await onAddTask(selectedGoal.id, activeMilestoneId, value)
      }
      setText('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick capture"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(8, 9, 18, 0.82)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '10vh 16px 24px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          borderRadius: 14,
          border: `1px solid ${T.borderHi}`,
          background: T.card,
          boxShadow: `0 20px 60px ${T.indigo}22`,
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['goal', 'task'] as const).map(option => (
            <button
              key={option}
              onClick={() => setMode(option)}
              style={{
                minHeight: 40,
                minWidth: 44,
                padding: '0 12px',
                borderRadius: 8,
                cursor: 'pointer',
                border: `1px solid ${mode === option ? T.indigo : T.border}`,
                background: mode === option ? `${T.indigo}20` : T.surface,
                color: mode === option ? T.indigo : T.textDim,
                fontFamily: T.mono,
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {option === 'goal' ? 'Quick Goal' : 'Quick Task'}
            </button>
          ))}
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              minHeight: 40,
              minWidth: 44,
              padding: '0 12px',
              borderRadius: 8,
              cursor: 'pointer',
              border: `1px solid ${T.border}`,
              background: 'transparent',
              color: T.dim,
              fontFamily: T.mono,
              fontSize: 11,
            }}
          >
            Esc
          </button>
        </div>

        {mode === 'task' && (
          <div style={{ marginBottom: 10 }}>
            <select
              value={selectedGoal?.id ?? ''}
              onChange={e => setSelectedGoalId(e.target.value)}
              style={{
                width: '100%',
                minHeight: 40,
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.text,
                fontFamily: T.mono,
                fontSize: 12,
                padding: '0 10px',
              }}
            >
              {activeGoals.map(goal => (
                <option key={goal.id} value={goal.id}>
                  {goal.smart_title}
                </option>
              ))}
            </select>
            {activeGoals.length === 0 && (
              <div style={{ marginTop: 6, fontFamily: T.mono, fontSize: 11, color: T.amber }}>
                No active goals available. Create a goal first.
              </div>
            )}
          </div>
        )}

        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              void submit()
            }
          }}
          rows={3}
          placeholder={
            mode === 'goal'
              ? 'Describe the goal quickly... (Ctrl/Cmd+Enter to save)'
              : 'Describe the task quickly... (Ctrl/Cmd+Enter to save)'
          }
          style={{
            width: '100%',
            resize: 'none',
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.text,
            fontFamily: T.mono,
            fontSize: 13,
            padding: '11px 12px',
            outline: 'none',
          }}
        />

        <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              minHeight: 40,
              minWidth: 44,
              padding: '0 14px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: 'transparent',
              color: T.textDim,
              cursor: 'pointer',
              fontFamily: T.mono,
              fontSize: 11,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={submitting || (mode === 'task' && !selectedGoal)}
            style={{
              minHeight: 40,
              minWidth: 44,
              padding: '0 14px',
              borderRadius: 8,
              border: `1px solid ${T.indigo}55`,
              background: `${T.indigo}22`,
              color: T.indigo,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting || (mode === 'task' && !selectedGoal) ? 0.5 : 1,
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: '0.05em',
            }}
          >
            {submitting ? 'Saving…' : mode === 'goal' ? 'Create Goal' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
