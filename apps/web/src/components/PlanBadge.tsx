import { Link } from 'react-router-dom'
import { usePlan } from '../hooks/usePlan'
import { T } from '../lib/theme'

export default function PlanBadge() {
  const { plan, isLoading } = usePlan()

  if (isLoading) return null

  if (plan === 'pro') {
    return (
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 99,
          background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
          color: '#fff',
          border: '1px solid #818cf840',
        }}
      >
        PRO
      </span>
    )
  }

  return (
    <Link
      to="/billing"
      style={{
        fontFamily: T.mono,
        fontSize: 10,
        letterSpacing: '0.08em',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 99,
        background: '#3f3f5c30',
        color: T.muted,
        border: `1px solid ${T.dim}`,
        textDecoration: 'none',
      }}
      title="Upgrade to Pro"
    >
      FREE
    </Link>
  )
}
