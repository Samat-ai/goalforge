import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { T } from '../lib/theme'

interface GoalLimitBannerProps {
  plan: string
  goalCount: number
}

const FREE_GOAL_LIMIT = 2

/**
 * Sticky banner shown below the header when a free-tier user has reached their
 * goal limit (2 active goals). Disappears for Pro users or when under the limit.
 */
export default function GoalLimitBanner({ plan, goalCount }: GoalLimitBannerProps) {
  const navigate = useNavigate()

  if (plan !== 'free' || goalCount < FREE_GOAL_LIMIT) return null

  return (
    <div style={{
      position: 'sticky', top: 54, zIndex: 99,
      background: 'linear-gradient(90deg, #92400e, #d97706)',
      padding: '9px 16px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <Lock size={13} color="#fff" style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: T.mono, fontSize: 12, color: '#fff', flex: 1, minWidth: 0, lineHeight: 1.5 }}>
        You've reached your free goal limit. Upgrade to add more.
      </span>
      <button
        onClick={() => navigate('/billing')}
        style={{
          background: '#fff',
          color: '#92400e',
          border: 'none',
          borderRadius: 6,
          fontFamily: T.mono,
          fontSize: 11,
          fontWeight: 700,
          padding: '6px 14px',
          cursor: 'pointer',
          minHeight: 32,
          flexShrink: 0,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}
      >
        Upgrade →
      </button>
    </div>
  )
}
