import { T } from '../../lib/theme'
import Btn from '../ui/Btn'
import SprintRail from '../SprintRail'
import type { Goal, Milestone } from '../../lib/types'

interface GoalCardMilestonesProps {
  goal: Goal
  isRescueMode: boolean
  dismissed: boolean
  isGenerating: boolean
  isAbandoned: boolean
  isAchieved: boolean
  activeMilestone: Milestone | undefined
  failedMilestone: Milestone | undefined
  isTriggeringRescue: boolean
  isRetryingSprintGeneration: boolean
  onStartEasyMode: () => void
  onDismiss: () => void
  onRetryGeneration: (milestoneId: string) => void
}

export default function GoalCardMilestones({
  goal,
  isRescueMode,
  dismissed,
  isGenerating,
  isAbandoned,
  isAchieved,
  activeMilestone,
  failedMilestone,
  isTriggeringRescue,
  isRetryingSprintGeneration,
  onStartEasyMode,
  onDismiss,
  onRetryGeneration,
}: GoalCardMilestonesProps) {
  return (
    <>
      {/* ── Generating skeleton ── */}
      {isGenerating && (
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{
            padding: '14px 16px',
            background: `${T.indigo}10`,
            borderRadius: 10,
            border: `1px solid ${T.indigo}30`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `${T.indigo}20`, border: `1.5px solid ${T.indigo}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, animation: 'pulse 1.5s ease-in-out infinite',
              color: T.indigo, flexShrink: 0,
            }}>✦</div>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontFamily: T.serif, marginBottom: 3 }}>
                Building your plan…
              </div>
              <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
                AI is generating milestones and tasks — this takes a few seconds
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recovery Sprint card — replaces SprintRail + DailyTaskList ── */}
      {isRescueMode && !dismissed && !isAbandoned && !isAchieved && (
        <div style={{ padding: '0 18px 22px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#2d1f4e', border: '1px solid #5b21b6',
            borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
            color: T.amber, fontFamily: T.mono,
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            ✦ EASY MODE
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6, lineHeight: 1.3 }}>
            Let's make today easy.
          </div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 18 }}>
            It looks like you've been busy. We paused your schedule and set up two quick wins
            for today — no pressure, no catching up.
          </div>
          <Btn
            variant="primary"
            style={{ width: '100%', marginBottom: 10 }}
            onClick={onStartEasyMode}
            disabled={isTriggeringRescue}
          >
            {isTriggeringRescue ? 'Starting easy mode…' : 'Start Easy Mode (2 min)'}
          </Btn>
          <button
            onClick={onDismiss}
            style={{
              display: 'block', width: '100%', textAlign: 'center',
              fontSize: 12, color: T.muted, background: 'none', border: 'none',
              textDecoration: 'underline', cursor: 'pointer', padding: 4, minHeight: 44,
            }}
          >
            I'm feeling good — show my full plan
          </button>
        </div>
      )}

      {/* ── Sprint Rail ── */}
      {(!isRescueMode || dismissed) && !isGenerating && !isAbandoned && !isAchieved && goal.milestones.length > 0 && (
        <SprintRail
          milestones={goal.milestones}
          activeMilestone={activeMilestone}
          milestonesTotal={goal.milestones_total}
          failedMilestone={failedMilestone}
          onRetryGeneration={onRetryGeneration}
          isRetrying={isRetryingSprintGeneration}
        />
      )}
    </>
  )
}
