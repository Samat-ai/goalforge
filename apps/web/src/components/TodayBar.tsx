import { T } from '../lib/theme'
import { todayStr } from '../lib/gamification'
import { pickOneThing } from '../lib/pickOneThing'
import type { Goal } from '../lib/types'

interface TodayBarProps {
  goals: Goal[]
  onFocusOpen?: () => void
}

export default function TodayBar({ goals, onFocusOpen }: TodayBarProps) {
  const today  = todayStr()
  const active = goals.filter(g => g.status === 'active')

  const todayAll     = active.flatMap(g => g.daily_tasks.filter(t => t.assigned_date === today))
  const doneCnt      = todayAll.filter(t => t.is_completed).length
  const overdueCnt   = active.flatMap(g =>
    g.daily_tasks.filter(t => !t.is_completed && t.assigned_date < today)
  ).length

  if (!active.length || (todayAll.length === 0 && overdueCnt === 0)) return null

  const hasToday = todayAll.length > 0
  const allDone  = hasToday && doneCnt === todayAll.length
  const barPct   = hasToday ? (doneCnt / todayAll.length) * 100 : 0

  const hasFocusItem = onFocusOpen != null && pickOneThing(goals) !== null

  return (
    <div
      role="status"
      aria-label={
        hasToday
          ? `Today's progress: ${doneCnt} of ${todayAll.length} tasks done${overdueCnt > 0 ? `, ${overdueCnt} to catch up` : ''}`
          : `${overdueCnt} tasks to catch up on`
      }
      style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11,
        padding: '13px 17px', marginBottom: 19, display: 'flex', alignItems: 'center', gap: 15,
      }}
    >
      <div>
        <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginBottom: 2 }}>TODAY</div>
        {hasToday ? (
          <div style={{ fontFamily: T.serif, fontSize: 19, color: T.text }}>
            {doneCnt} / {todayAll.length} done
            {overdueCnt > 0 && (
              <span style={{ fontSize: 12, color: T.amber, fontFamily: T.mono, marginLeft: 10 }}>
                · {overdueCnt} to catch up
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontFamily: T.serif, fontSize: 19, color: T.muted }}>
            – / –
            <span style={{ fontSize: 12, color: T.amber, fontFamily: T.mono, marginLeft: 10 }}>
              {overdueCnt} to catch up
            </span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, height: 5, background: T.dim, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: !hasToday ? T.amber : T.orange,
          width: `${barPct}%`, transition: 'width 0.5s',
        }} />
      </div>
      <span style={{ fontSize: 20 }}>{allDone ? '🏆' : !hasToday ? '⏳' : '🎯'}</span>

      {hasFocusItem && (
        <button
          onClick={onFocusOpen}
          aria-label="Enter focus mode"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 14px',
            borderRadius: 8,
            border: `1px solid ${T.indigo}40`,
            background: `${T.indigo}12`,
            color: T.indigo,
            fontFamily: T.mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span>⚡</span>
          <span>Focus</span>
        </button>
      )}
    </div>
  )
}
