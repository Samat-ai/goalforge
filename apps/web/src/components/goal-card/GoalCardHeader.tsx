import { T } from '../../lib/theme'
import { StarIcon } from '../GamificationSvgs'
import Badge from '../ui/Badge'
import type { Goal } from '../../lib/types'

interface GoalCardHeaderProps {
  goal: Goal
  open: boolean
  onToggle: () => void
  isGenerating: boolean
  isAbandoned: boolean
  isAchieved: boolean
  doneToday: boolean
  s: number
  lastStreak: number
  b: number
  days: number
  dl: string
}

export default function GoalCardHeader({
  goal,
  open,
  onToggle,
  isGenerating,
  isAbandoned,
  isAchieved,
  doneToday,
  s,
  lastStreak,
  b,
  days,
  dl,
}: GoalCardHeaderProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${goal.smart_title} — click to ${open ? 'collapse' : 'expand'}`}
      onClick={onToggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start' }}
    >
      <StarIcon b={b} size={52} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {!isGenerating && <Badge color={T.indigo}>{goal.goal_type}</Badge>}
          {isGenerating && <Badge color={T.muted}>generating…</Badge>}
          {isAbandoned  && <Badge color={T.muted}>abandoned</Badge>}
          {isAchieved   && <Badge color={T.amber}>✦ achieved</Badge>}
          {doneToday && !isAbandoned && !isAchieved && <Badge color={T.emerald}>✓ done today</Badge>}
          {s > 0 && !isAbandoned && <Badge color={T.amber}>{s}d streak</Badge>}
          {s === 0 && lastStreak >= 2 && !isAbandoned && !isAchieved && <Badge color={T.dim}>last streak: {lastStreak}d</Badge>}
          {goal.target_date && <Badge color={days < 0 ? T.rose : T.muted}>{dl}</Badge>}
        </div>
        <div style={{ fontSize: 15, color: isAbandoned ? T.muted : T.text, fontFamily: T.serif, lineHeight: 1.45, marginBottom: 3 }}>
          {goal.smart_title}
        </div>
        <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 3 }}>
          {goal.smart_description}
        </div>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>"{goal.raw_input}"</div>
      </div>

      <span style={{ color: T.dim, fontSize: 15, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
        ▾
      </span>
    </div>
  )
}
