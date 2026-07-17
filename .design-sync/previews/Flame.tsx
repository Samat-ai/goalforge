// Authored preview — Flame (streak chip: flame icon + count).
import { Flame } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 22, ...style }}>
    {children}
  </div>
)

const Chip = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    {children}
    <span style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>{label}</span>
  </div>
)

export function Streaks() {
  return (
    <Surface>
      <Chip label="3-day streak"><Flame n={3} /></Chip>
      <Chip label="12-day streak"><Flame n={12} size={16} /></Chip>
      <Chip label="gold"><Flame n={30} size={16} color="var(--gold)" /></Chip>
      <Chip label="muted (broken)"><Flame n={0} muted /></Chip>
    </Surface>
  )
}
