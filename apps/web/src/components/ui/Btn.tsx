export interface BtnProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'success'
  loading?: boolean
  small?: boolean
  disabled?: boolean
  style?: React.CSSProperties
}

export default function Btn({
  children, onClick, variant = 'primary', loading = false, small = false, disabled = false, style,
}: BtnProps) {
  const V = {
    primary: {
      background: 'linear-gradient(140deg, color-mix(in oklab, var(--accent) 88%, #fff 6%), var(--accent))',
      color: '#fff', border: 'none',
    },
    ghost:   { background: 'transparent', color: 'var(--text-mute)', border: '1px solid var(--border)' },
    danger:  { background: 'transparent', color: 'var(--rose)',  border: '1px solid color-mix(in oklab, var(--rose) 25%, transparent)' },
    success: { background: 'color-mix(in oklab, var(--ring-2) 12%, transparent)', color: 'var(--ring-2)', border: '1px solid color-mix(in oklab, var(--ring-2) 25%, transparent)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        cursor: loading || disabled ? 'default' : 'pointer',
        height: small ? 36 : 44, padding: small ? '0 14px' : '0 18px',
        borderRadius: 13, fontFamily: 'var(--font-mono)', fontSize: small ? 11 : 12,
        fontWeight: 500, letterSpacing: '0.04em', opacity: disabled ? 0.4 : 1,
        display: 'inline-flex', alignItems: 'center',
        ...V[variant],
        ...style,
      }}
    >
      {loading ? '···' : children}
    </button>
  )
}
