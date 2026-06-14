import { Link } from 'react-router-dom'
import { usePlan } from '../hooks/usePlan'
import { T } from '../lib/theme'

type GatedFeature =
  | 'coaching'
  | 'energy_resize'
  | 'analytics_full'
  | 'accountability'
  | 'export'
  | 'goals'

const FEATURE_LABELS: Record<GatedFeature, string> = {
  coaching: 'AI Coaching',
  energy_resize: 'Energy Resize',
  analytics_full: 'Full Analytics',
  accountability: 'Accountability Partners',
  export: 'Data Export',
  goals: 'Unlimited Goals',
}

interface UpgradeGateProps {
  feature: GatedFeature
  children: React.ReactNode
  fallback?: React.ReactNode
}

function DefaultLockCard({ feature }: { feature: GatedFeature }) {
  const label = FEATURE_LABELS[feature]
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${T.borderHi}`,
        background: T.card,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 28 }}>🔒</div>
      <div style={{ fontFamily: T.serif, fontSize: 16, color: T.text }}>
        {label}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim, maxWidth: 280 }}>
        {label} is a Pro feature. Unlock it by upgrading your plan.
      </div>
      <Link
        to="/billing"
        style={{
          marginTop: 4,
          padding: '8px 18px',
          borderRadius: 8,
          background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
          color: '#fff',
          fontFamily: T.mono,
          fontSize: 12,
          letterSpacing: '0.05em',
          textDecoration: 'none',
          border: 'none',
        }}
      >
        Upgrade to Pro
      </Link>
    </div>
  )
}

export default function UpgradeGate({ feature, children, fallback }: UpgradeGateProps) {
  const { isPro, isLoading } = usePlan()

  if (isLoading) return null

  if (isPro) {
    return <>{children}</>
  }

  return <>{fallback ?? <DefaultLockCard feature={feature} />}</>
}
