import { T } from '../lib/theme'
import { todayStr } from '../lib/gamification'
import type { Goal } from '../lib/types'

interface TodayBarProps {
  goals: Goal[]
}

export default function TodayBar({ goals }: TodayBarProps) {
  const active   = goals.filter(g => g.status === 'active')
  const todayAll = active.flatMap(g => g.daily_tasks.filter(t => t.assigned_date === todayStr()))
  const doneCnt  = todayAll.filter(t => t.is_completed).length
  if (!active.length || !todayAll.length) return null

  return (
    <div
      role="status"
      aria-label={`Today's progress: ${doneCnt} of ${todayAll.length} tasks done`}
      style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11,
        padding: '13px 17px', marginBottom: 19, display: 'flex', alignItems: 'center', gap: 15,
      }}
    >
      <div>
        <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginBottom: 2 }}>TODAY</div>
        <div style={{ fontFamily: T.serif, fontSize: 19, color: T.text }}>{doneCnt} / {todayAll.length} done</div>
      </div>
      <div style={{ flex: 1, height: 5, background: T.dim, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: T.orange,
          width: `${(doneCnt / todayAll.length) * 100}%`, transition: 'width 0.5s',
        }} />
      </div>
      <span style={{ fontSize: 20 }}>{doneCnt === todayAll.length ? '🏆' : '🎯'}</span>
    </div>
  )
}
