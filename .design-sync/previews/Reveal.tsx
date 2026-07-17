// Authored preview — Reveal (staggered entrance wrapper). The app's own
// __gfRevealOff switch renders it statically — the capture clock never ticks
// CSS animations, and static render is exactly Reveal's post-entrance state.
import { Reveal, Icon } from 'web'
import type { CSSProperties, ReactNode } from 'react'

declare global { interface Window { __gfRevealOff?: boolean } }
if (typeof window !== 'undefined') window.__gfRevealOff = true

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
    {children}
  </div>
)

const Card = ({ title, sub }: { title: string; sub: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px' }}>
    <Icon name="spark" size={16} style={{ color: 'var(--accent)' }} />
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>{sub}</div>
    </div>
  </div>
)

export function StaggeredList() {
  return (
    <Surface style={{ maxWidth: 420 }}>
      <Reveal delay={40}><Card title="First card" sub="delay 40ms" /></Reveal>
      <Reveal delay={120}><Card title="Second card" sub="delay 120ms" /></Reveal>
      <Reveal delay={200}><Card title="Third card" sub="delay 200ms — cards fade-slide in on first mount" /></Reveal>
    </Surface>
  )
}
