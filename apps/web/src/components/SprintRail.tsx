import { useT } from '../lib/theme'
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
  const T = useT()
  const displayMilestone = activeMilestone ?? failedMilestone

  return (
    <div style={{ margin: '0 18px 12px', padding: '10px 14px', background: `${T.indigo}08`, borderRadius: 9, border: `1px solid ${T.indigo}20` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: T.indigo, fontFamily: T.mono, letterSpacing: '0.1em', flexShrink: 0 }}>
          SPRINT {displayMilestone?.position ?? '—'} OF {milestonesTotal}
        </span>
        {failedMilestone ? (
          <>
            <span style={{ fontSize: 10, color: T.rose, fontFamily: T.mono, flex: 1, minWidth: 0 }}>
              Sprint generation failed
            </span>
            <button
              onClick={() => onRetryGeneration(failedMilestone.id)}
              disabled={isRetrying}
              style={{
                cursor: isRetrying ? 'default' : 'pointer',
                padding: '3px 10px', borderRadius: 6,
                fontFamily: T.mono, fontSize: 10, fontWeight: 500,
                background: `${T.rose}15`, color: T.rose,
                border: `1px solid ${T.rose}50`,
                opacity: isRetrying ? 0.6 : 1,
                minHeight: 44, minWidth: 44,
                transition: 'opacity 0.15s',
              }}
            >
              {isRetrying ? '···' : 'Retry'}
            </button>
          </>
        ) : activeMilestone?.sprint_status === 'generating' ? (
          <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, animation: 'pulse 1.5s ease-in-out infinite' }}>
            AI forging next sprint
          </span>
        ) : activeMilestone ? (
          <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>— {activeMilestone.title}</span>
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
              fontSize: 9, fontFamily: T.mono,
              background: m.is_completed
                ? `${T.emerald}20`
                : isActive ? `${T.indigo}25`
                : isFailed ? `${T.rose}20`
                : `${T.dim}15`,
              border: m.is_completed
                ? `1.5px solid ${T.emerald}60`
                : isActive ? `1.5px solid ${T.indigo}70`
                : isFailed ? `1.5px solid ${T.rose}60`
                : `1.5px solid ${T.dim}`,
              color: m.is_completed ? T.emerald : isActive ? T.indigo : isFailed ? T.rose : T.muted,
            }}>
              {m.is_completed ? '✓' : isFailed ? '✕' : m.position}
            </div>
          )
          if (i === 0) return [dot]
          const line = (
            <div key={`line-${i}`} style={{
              flex: 1, height: 1, minWidth: 8,
              background: m.is_completed ? T.emerald : i <= (displayMilestone?.position ?? 1) - 1 ? T.indigo : T.dim,
              opacity: 0.35,
            }} />
          )
          return [line, dot]
        })}
      </div>
    </div>
  )
}
