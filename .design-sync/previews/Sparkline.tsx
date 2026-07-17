// Authored preview — Sparkline (trend mini-chart, gradient fill + end dot).
import { Sparkline } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, display: 'flex', alignItems: 'flex-end', gap: 28, ...style }}>
    {children}
  </div>
)

const Stat = ({ label, value, children }: { label: string; value: string; children: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</div>
    {children}
  </div>
)

export function Trends() {
  return (
    <Surface>
      <Stat label="Tasks this week" value="14">
        <Sparkline data={[1, 2, 2, 3, 2, 4, 5]} />
      </Stat>
      <Stat label="Star points" value="+120">
        <Sparkline data={[10, 25, 15, 40, 35, 20, 45]} color="var(--gold)" />
      </Stat>
      <Stat label="Line only" value="7d">
        <Sparkline data={[3, 2, 4, 3, 5, 4, 6]} color="var(--indigo)" fill={false} />
      </Stat>
    </Surface>
  )
}
