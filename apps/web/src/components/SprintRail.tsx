import type { Milestone } from '../lib/types'

interface SprintRailProps {
  milestones: Milestone[]
  activeMilestone: Milestone | undefined
  milestonesTotal: number
  failedMilestone: Milestone | undefined
  onRetryGeneration: (milestoneId: string) => void
  isRetrying: boolean
}

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
          const dot = (
            <div key={m.id} className={`gf-sr-dot${m.is_completed ? ' is-done' : isActive ? ' is-active' : isFailed ? ' is-fail' : ''}`}>
              {m.is_completed ? '✓' : isFailed ? '✕' : m.position}
            </div>
          )
          if (i === 0) return [dot]
          const isDoneLine = m.is_completed
          const isActiveLine = i <= (displayMilestone?.position ?? 1) - 1
          const line = (
            <div
              key={`line-${i}`}
              className={`gf-sr-line${isDoneLine ? ' is-done' : isActiveLine ? ' is-active' : ''}`}
            />
          )
          return [line, dot]
        })}
      </div>
    </div>
  )
}
