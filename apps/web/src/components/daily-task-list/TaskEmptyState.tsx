import { T } from '../../lib/theme'

/**
 * TaskEmptyState — shown when there are no tasks for today and no active milestone.
 */
export default function TaskEmptyState() {
  return (
    <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, padding: '4px 0' }}>
      No tasks scheduled for today.
    </div>
  )
}
