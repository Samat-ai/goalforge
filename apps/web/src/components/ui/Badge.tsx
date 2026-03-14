import { T } from '../../lib/theme'

export interface BadgeProps {
  children: React.ReactNode
  color?: string
}

export default function Badge({ children, color = T.orange }: BadgeProps) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em',
      border: `1px solid ${color}50`, background: `${color}15`, color,
    }}>
      {children}
    </span>
  )
}
