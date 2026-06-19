import { T } from '../../lib/theme'

export interface BadgeProps {
  children: React.ReactNode
  color?: string
}

export default function Badge({ children, color = T.orange }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      height: 26, padding: '0 11px', borderRadius: 99,
      fontFamily: T.mono, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.07em',
      border: `1px solid color-mix(in oklab, ${color} 38%, transparent)`,
      background: `color-mix(in oklab, ${color} 12%, transparent)`,
      color,
    }}>
      {children}
    </span>
  )
}
