// Authored preview — Icon (prototype SVG path registry; name from gf/util ICONS).
import { Icon } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, ...style }}>
    {children}
  </div>
)

const NAMES = ['spark', 'flame', 'target', 'check', 'trophy', 'bolt', 'heart', 'book', 'run', 'brain', 'clock', 'gear', 'chart', 'chat', 'moon', 'sun', 'pencil', 'refresh']

export function Registry() {
  return (
    <Surface>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 64px)', gap: 14 }}>
        {NAMES.map(n => (
          <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Icon name={n} size={20} />
            <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>{n}</span>
          </div>
        ))}
      </div>
    </Surface>
  )
}

export function SizesAndStroke() {
  return (
    <Surface style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <Icon name="spark" size={14} />
      <Icon name="spark" size={18} />
      <Icon name="spark" size={24} />
      <Icon name="spark" size={32} />
      <span style={{ width: 1, height: 28, background: 'var(--border)' }} />
      <Icon name="target" size={24} stroke={1.2} />
      <Icon name="target" size={24} stroke={1.75} />
      <Icon name="target" size={24} stroke={2.6} />
      <span style={{ width: 1, height: 28, background: 'var(--border)' }} />
      <span style={{ color: 'var(--accent)' }}><Icon name="flame" size={24} /></span>
      <span style={{ color: 'var(--gold)' }}><Icon name="trophy" size={24} /></span>
      <span style={{ color: 'var(--indigo)' }}><Icon name="brain" size={24} /></span>
    </Surface>
  )
}
