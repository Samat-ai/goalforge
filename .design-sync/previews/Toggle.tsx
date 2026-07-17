// Authored preview — Toggle (iOS-style switch, controlled via checked/onChange).
import { useState } from 'react'
import { Toggle } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, ...style }}>
    {children}
  </div>
)

const Row = ({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '10px 0' }}>
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 2 }}>{sub}</div>}
    </div>
    {children}
  </div>
)

export function States() {
  return (
    <Surface style={{ maxWidth: 380 }}>
      <Row label="Daily reminders" sub="One gentle nudge at your chosen hour">
        <Toggle checked={true} onChange={() => {}} label="Daily reminders" />
      </Row>
      <Row label="Weekly star log push" sub="Sunday chapter teaser">
        <Toggle checked={false} onChange={() => {}} label="Weekly star log push" />
      </Row>
    </Surface>
  )
}

export function Interactive() {
  const [on, setOn] = useState(true)
  return (
    <Surface style={{ maxWidth: 380 }}>
      <Row label="Low-energy mode hints" sub={on ? 'Solly will suggest lighter days' : 'Suggestions off'}>
        <Toggle checked={on} onChange={setOn} label="Low-energy mode hints" />
      </Row>
    </Surface>
  )
}
