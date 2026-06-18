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
    primary: { background: 'var(--accent)',                                                        color: '#fff',              border: 'none' },
    ghost:   { background: 'transparent',                                                          color: 'var(--text-mute)',  border: '1px solid var(--border)' },
    danger:  { background: 'transparent',                                                          color: 'var(--rose)',       border: '1px solid color-mix(in oklab, var(--rose) 40%, transparent)' },
    success: { background: 'color-mix(in oklab, var(--emerald) 20%, transparent)',                 color: 'var(--emerald)',    border: '1px solid color-mix(in oklab, var(--emerald) 40%, transparent)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        cursor: loading || disabled ? 'default' : 'pointer',
        padding: small ? '9px 14px' : '9px 18px',
        borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: small ? 11 : 12,
        fontWeight: 500, letterSpacing: '0.04em', opacity: disabled ? 0.4 : 1,
        ...V[variant],
        ...style,
      }}
    >
      {loading ? '···' : children}
    </button>
  )
}
