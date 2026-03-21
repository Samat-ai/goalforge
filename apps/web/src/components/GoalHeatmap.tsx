import { T } from '../lib/theme'
import { Heatmap } from './GamificationSvgs'

interface GoalHeatmapProps {
  completedDays: string[]
}

export default function GoalHeatmap({ completedDays }: GoalHeatmapProps) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 9 }}>
        COMPLETION HISTORY — {completedDays.length} days
      </div>
      <Heatmap days={completedDays} />
    </div>
  )
}
