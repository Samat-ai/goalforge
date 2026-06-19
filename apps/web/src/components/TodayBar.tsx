import { todayStr } from '../lib/gamification'
import { pickOneThing } from '../lib/pickOneThing'
import type { Goal } from '../lib/types'

interface TodayBarProps {
  goals: Goal[]
  onFocusOpen?: () => void
  onEnergyOpen?: () => void
}

export default function TodayBar({ goals, onFocusOpen, onEnergyOpen }: TodayBarProps) {
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
  const hasPendingToday = hasToday && doneCnt < todayAll.length

  return (
    <div
      role="status"
      className="gf-today"
      aria-label={
        hasToday
          ? `Today's progress: ${doneCnt} of ${todayAll.length} tasks done${overdueCnt > 0 ? `, ${overdueCnt} to catch up` : ''}`
          : `${overdueCnt} tasks to catch up on`
      }
    >
      <div className="gf-today-info">
        <div className="gf-today-label">Today</div>
        <div className="gf-today-stat">
          {hasToday ? (
            <>
              {doneCnt} / {todayAll.length}
              {overdueCnt > 0 && <span>+{overdueCnt} overdue</span>}
              {allDone && <span className="is-done">· All done ✦</span>}
            </>
          ) : (
            <>– / –<span>{overdueCnt} to catch up</span></>
          )}
        </div>
      </div>

      <div className="gf-today-track">
        <div
          className={['gf-today-fill', !hasToday && 'is-amber'].filter(Boolean).join(' ')}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {hasFocusItem && (
        <button
          onClick={onFocusOpen}
          aria-label="Enter focus mode"
          className="gf-btn-ghost-indigo"
        >
          <span>⚡</span>
          <span>Focus</span>
        </button>
      )}

      {onEnergyOpen != null && hasPendingToday && (
        <button
          onClick={onEnergyOpen}
          aria-label="Low energy mode — simplify today's tasks"
          className="gf-btn-ghost-purple"
        >
          <span>🌙</span>
          <span>Low energy</span>
        </button>
      )}
    </div>
  )
}
