import { T } from '../../lib/theme'

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
      background: `linear-gradient(140deg, color-mix(in oklab, ${T.orange} 88%, #fff 6%), ${T.orange})`,
      color: '#fff', border: 'none',
    },
    ghost:   { background: 'transparent', color: T.muted, border: `1px solid ${T.border}` },
    danger:  { background: 'transparent', color: T.rose,  border: `1px solid ${T.rose}40` },
    success: { background: `${T.emerald}20`, color: T.emerald, border: `1px solid ${T.emerald}40` },
  }
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        cursor: loading || disabled ? 'default' : 'pointer',
        height: small ? 36 : 44, padding: small ? '0 14px' : '0 18px',
        borderRadius: 13, fontFamily: T.mono, fontSize: small ? 11 : 12,
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
