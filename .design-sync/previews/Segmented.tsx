// Authored preview — Segmented control with sliding pill (Dashboard filter,
// Analytics range). Pill position measures on mount; interactive cell shows the slide.
import { useState } from 'react'
import { Segmented } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', ...style }}>
    {children}
  </div>
)

export function GoalFilter() {
  const [value, setValue] = useState<'active' | 'achieved' | 'abandoned'>('active')
  return (
    <Surface>
      <Segmented options={['active', 'achieved', 'abandoned']} value={value} onChange={setValue} />
    </Surface>
  )
}

export function WithLabels() {
  const [value, setValue] = useState<'7d' | '30d' | '90d'>('30d')
  return (
    <Surface>
      <Segmented
        options={['7d', '30d', '90d']}
        value={value}
        onChange={setValue}
        getLabel={o => ({ '7d': 'Week', '30d': 'Month', '90d': 'Quarter' }[o] as string)}
      />
    </Surface>
  )
}
