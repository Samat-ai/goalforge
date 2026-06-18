export interface BadgeProps {
  children: React.ReactNode
  color?: string
}

export default function Badge({ children, color }: BadgeProps) {
  const c = color ?? 'var(--accent)'
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em',
      border: `1px solid color-mix(in oklab, ${c} 50%, transparent)`,
      background: `color-mix(in oklab, ${c} 15%, transparent)`, color: c,
    }}>
      {children}
    </span>
  )
}
