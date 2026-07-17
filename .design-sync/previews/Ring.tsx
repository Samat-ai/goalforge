// Authored preview — Ring (animated progress ring). fromRatio={1} pins the ring
// at its final value: the headless capture never ticks transition clocks.
import { Ring } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 26, ...style }}>
    {children}
  </div>
)

export function Progress() {
  return (
    <Surface>
      <Ring value={0.72} fromRatio={1}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>72%</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>this sprint</div>
        </div>
      </Ring>
      <Ring value={0.35} size={84} stroke={9} color="var(--gold)" fromRatio={1}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>35%</div>
      </Ring>
      <Ring value={1} size={64} stroke={8} color="var(--green)" fromRatio={1}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>✓</div>
      </Ring>
    </Surface>
  )
}
