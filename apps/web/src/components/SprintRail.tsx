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
    <div style={{ padding: '10px 14px', background: 'color-mix(in oklab, var(--indigo) 8%, transparent)', borderRadius: 10, border: '1px solid color-mix(in oklab, var(--indigo) 20%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--indigo)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', flexShrink: 0 }}>
          SPRINT {displayMilestone?.position ?? '—'} OF {milestonesTotal}
        </span>
        {failedMilestone ? (
          <>
            <span style={{ fontSize: 10, color: 'var(--rose)', fontFamily: 'var(--font-mono)', flex: 1, minWidth: 0 }}>
              Sprint generation failed
            </span>
            <button
              onClick={() => onRetryGeneration(failedMilestone.id)}
              disabled={isRetrying}
              className="gf-btn-pill is-danger"
              style={{ opacity: isRetrying ? 0.6 : 1, cursor: isRetrying ? 'default' : 'pointer' }}
            >
              {isRetrying ? '···' : 'Retry'}
            </button>
          </>
        ) : activeMilestone?.sprint_status === 'generating' ? (
          <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', animation: 'pulse 1.5s ease-in-out infinite' }}>
            AI forging next sprint
          </span>
        ) : activeMilestone ? (
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            — {activeMilestone.title}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {milestones.flatMap((m, i) => {
          const isActive = m.sprint_status === 'active' || m.sprint_status === 'generating'
          const isFailed = m.sprint_status === 'failed'
          const dot = (
            <div key={m.id} className={`gf-ms-dot${m.is_completed ? ' is-done' : isActive ? ' is-active' : isFailed ? ' is-fail' : ''}`}
              style={{ width: 20, height: 20 }}>
              {m.is_completed ? '✓' : isFailed ? '✕' : m.position}
            </div>
          )
          if (i === 0) return [dot]
          const line = (
            <div key={`line-${i}`} style={{
              flex: 1, height: 1, minWidth: 8, opacity: 0.35,
              background: m.is_completed ? 'var(--ring-2)' : i <= (displayMilestone?.position ?? 1) - 1 ? 'var(--indigo)' : 'var(--text-mute)',
            }} />
          )
          return [line, dot]
        })}
      </div>
    </div>
  )
}
