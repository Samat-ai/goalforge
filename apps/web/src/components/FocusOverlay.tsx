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
      <div role="dialog" aria-modal="true" aria-label="Task complete" className="gf-overlay">
        <div className="gf-fov-done">
          <div className="gf-fov-done-star">⭐</div>
          <div className="gf-fov-done-pts">Star Points earned ⭐</div>
          <div className="gf-fov-done-msg">{doneMessage}</div>
          <button onClick={onClose} className="gf-fov-btn is-back">Back to Dashboard</button>
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
    <div role="dialog" aria-modal="true" aria-label="Focus mode" className="gf-overlay">
      <button onClick={onClose} aria-label="Exit focus mode" className="gf-fov-close">✕ Exit Focus</button>
      <div className="gf-fov">
        <div>
          <div className="gf-fov-goal">{goal.smart_title}</div>
          {milestone.sprint_theme && <div className="gf-fov-theme">{milestone.sprint_theme}</div>}
        </div>
        <div className="gf-fov-cap">Your one thing right now</div>
        <div className="gf-fov-task">{task.description}</div>
        {task.tip && <div className="gf-fov-tip">&quot;{task.tip}&quot;</div>}
        <button onClick={handleComplete} disabled={completing} className="gf-fov-btn">
          Mark Complete ⭐
        </button>
      </div>
    </div>
  )
}
