// Authored preview — GoalCardSkeleton (Dashboard goal-card loading shell, no props).
import { GoalCardSkeleton } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, ...style }}>
    {children}
  </div>
)

export function Loading() {
  return (
    <Surface style={{ maxWidth: 440 }}>
      <GoalCardSkeleton />
    </Surface>
  )
}
