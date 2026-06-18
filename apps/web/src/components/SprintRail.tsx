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
    <div style={{ margin: '0 18px 12px', padding: '10px 14px', background: 'color-mix(in oklab, var(--indigo) 8%, transparent)', borderRadius: 9, border: '1px solid color-mix(in oklab, var(--indigo) 20%, transparent)' }}>
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
              style={{
                cursor: isRetrying ? 'default' : 'pointer',
                padding: '3px 10px', borderRadius: 6,
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
                background: 'color-mix(in oklab, var(--rose) 15%, transparent)', color: 'var(--rose)',
                border: '1px solid color-mix(in oklab, var(--rose) 50%, transparent)',
                opacity: isRetrying ? 0.6 : 1,
                minHeight: 44, minWidth: 44,
                transition: 'opacity 0.15s',
              }}
            >
              {isRetrying ? '···' : 'Retry'}
            </button>
          </>
        ) : activeMilestone?.sprint_status === 'generating' ? (
          <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', animation: 'pulse 1.5s ease-in-out infinite' }}>
            AI forging next sprint
          </span>
        ) : activeMilestone ? (
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>— {activeMilestone.title}</span>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {milestones.flatMap((m, i) => {
          const isActive = m.sprint_status === 'active' || m.sprint_status === 'generating'
          const isFailed = m.sprint_status === 'failed'
          const dot = (
            <div key={m.id} style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontFamily: 'var(--font-mono)',
              background: m.is_completed
                ? 'color-mix(in oklab, var(--emerald) 20%, transparent)'
                : isActive ? 'color-mix(in oklab, var(--indigo) 25%, transparent)'
                : isFailed ? 'color-mix(in oklab, var(--rose) 20%, transparent)'
                : 'color-mix(in oklab, var(--text-mute) 15%, transparent)',
              border: m.is_completed
                ? '1.5px solid color-mix(in oklab, var(--emerald) 60%, transparent)'
                : isActive ? '1.5px solid color-mix(in oklab, var(--indigo) 70%, transparent)'
                : isFailed ? '1.5px solid color-mix(in oklab, var(--rose) 60%, transparent)'
                : '1.5px solid var(--text-mute)',
              color: m.is_completed ? 'var(--emerald)' : isActive ? 'var(--indigo)' : isFailed ? 'var(--rose)' : 'var(--text-mute)',
            }}>
              {m.is_completed ? '✓' : isFailed ? '✕' : m.position}
            </div>
          )
          if (i === 0) return [dot]
          const line = (
            <div key={`line-${i}`} style={{
              flex: 1, height: 1, minWidth: 8,
              background: m.is_completed ? 'var(--emerald)' : i <= (displayMilestone?.position ?? 1) - 1 ? 'var(--indigo)' : 'var(--text-mute)',
              opacity: 0.35,
            }} />
          )
          return [line, dot]
        })}
      </div>
    </div>
  )
}
