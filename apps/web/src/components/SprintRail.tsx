import type { Milestone } from '../lib/types'

interface SprintRailProps {
  milestones: Milestone[]
  activeMilestone: Milestone | undefined
  milestonesTotal: number
  failedMilestone: Milestone | undefined
  onRetryGeneration: (milestoneId: string) => void
  isRetrying: boolean
}

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

export default function SprintRail({
  milestones, activeMilestone, milestonesTotal,
  failedMilestone, onRetryGeneration, isRetrying,
}: SprintRailProps) {
  const displayMilestone = activeMilestone ?? failedMilestone

  return (
    <div className="gf-sr">
      <div className="gf-sr-head">
        <span className="gf-sr-label">
          SPRINT {displayMilestone?.position ?? '—'} OF {milestonesTotal}
        </span>
        {failedMilestone ? (
          <>
            <span className="gf-sr-err">Sprint generation failed</span>
            <button
              onClick={() => onRetryGeneration(failedMilestone.id)}
              disabled={isRetrying}
              className="gf-sr-retry"
            >
              {isRetrying ? '···' : 'Retry'}
            </button>
          </>
        ) : activeMilestone?.sprint_status === 'generating' ? (
          <span className="gf-sr-gen">AI forging next sprint</span>
        ) : activeMilestone ? (
          <span className="gf-sr-title">— {activeMilestone.title}</span>
        ) : null}
      </div>

      <div className="gf-sr-dots">
        {milestones.flatMap((m, i) => {
          const isActive = m.sprint_status === 'active' || m.sprint_status === 'generating'
          const isFailed = m.sprint_status === 'failed'
          const dotClass = cx(
            'gf-sr-dot',
            m.is_completed && 'is-done',
            !m.is_completed && isActive && 'is-active',
            !m.is_completed && isFailed && 'is-fail',
          )
          const dot = (
            <div key={m.id} className={dotClass}>
              {m.is_completed ? '✓' : isFailed ? '✕' : m.position}
            </div>
          )
          if (i === 0) return [dot]
          const activePos = displayMilestone?.position ?? 1
          const lineClass = cx(
            'gf-sr-line',
            m.is_completed && 'is-done',
            !m.is_completed && i <= activePos - 1 && 'is-active',
          )
          return [<div key={`line-${i}`} className={lineClass} />, dot]
        })}
      </div>
    </div>
  )
}
