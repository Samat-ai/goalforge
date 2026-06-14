import { T } from '../../lib/theme'
import Btn from '../ui/Btn'
import type { Goal, Milestone } from '../../lib/types'

interface GoalCardActionsProps {
  goal: Goal
  isGenerating: boolean
  isAbandoned: boolean
  isAchieved: boolean
  allMilestonesComplete: boolean
  allSprintTasksDone: boolean
  activeMilestone: Milestone | undefined
  nextMilestone: Milestone | undefined
  doneToday: boolean
  completingMilestone: boolean
  confirmAbandon: boolean
  confirmDelete: boolean
  onAchieve: () => void
  onCompleteMilestone: () => void
  onAbandonClick: () => void
  onDeleteClick: () => void
  onRevive: () => void
}

export default function GoalCardActions({
  goal,
  isGenerating,
  isAbandoned,
  isAchieved,
  allMilestonesComplete,
  allSprintTasksDone,
  activeMilestone,
  nextMilestone,
  doneToday,
  completingMilestone,
  confirmAbandon,
  confirmDelete,
  onAchieve,
  onCompleteMilestone,
  onAbandonClick,
  onDeleteClick,
  onRevive,
}: GoalCardActionsProps) {
  // Delete button shared between both states
  const deleteButton = (
    <button
      onClick={onDeleteClick}
      aria-label={confirmDelete ? 'Confirm delete goal' : 'Delete goal'}
      style={{
        cursor: 'pointer', minHeight: 44, minWidth: 44,
        padding: '9px 14px', borderRadius: 8, fontFamily: T.mono,
        fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
        background: confirmDelete ? `${T.rose}25` : 'transparent',
        color: T.rose,
        border: confirmDelete ? `1px solid ${T.rose}80` : `1px solid ${T.rose}40`,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {confirmDelete ? 'Sure? Delete' : 'Delete'}
    </button>
  )

  if (!isGenerating && !isAbandoned && !isAchieved) {
    return (
      <div style={{ padding: '0 18px 14px', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        {allMilestonesComplete ? (
          <button
            onClick={onAchieve}
            style={{
              cursor: 'pointer', padding: '5px 14px', borderRadius: 8,
              fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
              background: `${T.amber}20`, color: T.amber, border: `1px solid ${T.amber}60`,
              boxShadow: `0 0 14px ${T.amber}50`,
            }}
          >
            ✦ Ascend to Achieved
          </button>
        ) : allSprintTasksDone && activeMilestone ? (
          <button
            onClick={onCompleteMilestone}
            disabled={completingMilestone}
            style={{
              cursor: completingMilestone ? 'default' : 'pointer',
              padding: '5px 14px', borderRadius: 8,
              fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
              background: `${T.indigo}20`, color: T.indigo, border: `1px solid ${T.indigo}55`,
              boxShadow: `0 0 12px ${T.indigo}35`, opacity: completingMilestone ? 0.6 : 1,
            }}
          >
            {completingMilestone
              ? '···'
              : `✦ Complete Sprint → ${nextMilestone ? 'Start ' + nextMilestone.title : 'Final Lap'}`}
          </button>
        ) : doneToday ? (
          <span style={{
            padding: '5px 12px', borderRadius: 8, fontFamily: T.mono, fontSize: 11,
            background: `${T.emerald}15`, color: T.emerald, border: `1px solid ${T.emerald}40`,
            letterSpacing: '0.04em',
          }}>
            ✓ Today's Work Done
          </span>
        ) : null}
        <button
          onClick={onAbandonClick}
          aria-label={confirmAbandon ? 'Confirm abandon goal' : 'Abandon goal'}
          style={{
            cursor: 'pointer', minHeight: 44, minWidth: 44,
            padding: '9px 14px', borderRadius: 8, fontFamily: T.mono,
            fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
            background: confirmAbandon ? `${T.amber}15` : 'transparent',
            color: confirmAbandon ? T.amber : T.muted,
            border: confirmAbandon ? `1px solid ${T.amber}60` : `1px solid ${T.border}`,
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
        >
          {confirmAbandon ? 'Sure? Abandon' : '✕ Abandon'}
        </button>
        {deleteButton}
      </div>
    )
  }

  if (isAbandoned || isAchieved) {
    return (
      <div style={{ padding: '0 18px 14px', display: 'flex', gap: 7 }}>
        {isAbandoned && <Btn onClick={onRevive} variant="ghost" small>▶ Revive</Btn>}
        {deleteButton}
      </div>
    )
  }

  return null
}
