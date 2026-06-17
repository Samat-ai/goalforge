import { useT } from '../../lib/theme'

export interface BadgeProps {
  children: React.ReactNode
  color?: string
}

export default function Badge({ children, color }: BadgeProps) {
  const T = useT()
  const c = color ?? T.orange
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em',
      border: `1px solid ${c}50`, background: `${c}15`, color: c,
    }}>
      {children}
    </span>
  )
}
