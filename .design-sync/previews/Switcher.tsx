// Authored preview — Switcher (exit→enter cross-fade on value change; static here).
import { Switcher, Icon } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, ...style }}>
    {children}
  </div>
)

export function TabContent() {
  return (
    <Surface style={{ maxWidth: 460 }}>
      <Switcher value="today">
        {shown => (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="check" size={14} style={{ color: 'var(--green)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>shown: {shown}</span>
            </div>
            <div style={{ fontSize: 13.5 }}>
              Panel content cross-fades exactly once when <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>value</code> changes —
              used for page nav and list-filter transitions.
            </div>
          </div>
        )}
      </Switcher>
    </Surface>
  )
}
