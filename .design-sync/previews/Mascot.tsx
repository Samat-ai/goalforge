// Authored preview — Mascot (geometric spark companion, evolves by stageId 0–5).
import { Mascot } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, ...style }}>
    {children}
  </div>
)

const STAGES = ['Speck', 'Ember', 'Flare', 'Luminary', 'Nova', 'Celestial']

export function EvolutionStages() {
  return (
    <Surface>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
        {STAGES.map((name, i) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Mascot stageId={i} size={56 + i * 6} />
            <span style={{ fontSize: 10.5, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>{name}</span>
          </div>
        ))}
      </div>
    </Surface>
  )
}

export function Hero() {
  return (
    <Surface style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <Mascot stageId={3} size={120} />
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Current stage</div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)' }}>Luminary</div>
      </div>
    </Surface>
  )
}
