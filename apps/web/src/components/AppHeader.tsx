import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/react'
import { getStage } from '../lib/gamification'
import { T } from '../lib/theme'
import { useRewardsQuery } from '../hooks/useRewards'

const THEME_KEY_TO_CLASS: Record<string, string> = {
  neon_cyberpunk: 'theme-neon-cyberpunk',
  matcha_green: 'theme-matcha-green',
  midnight_ocean: 'theme-midnight-ocean',
  sunset_ember: 'theme-sunset-ember',
}

interface AppHeaderProps {
  pts: number
  onOpenCollection?: () => void
}

export default function AppHeader({ pts, onOpenCollection }: AppHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  const stage = getStage(pts)

  const { data: rewards = [] } = useRewardsQuery(user?.id ?? '')

  const equippedTitle = rewards.find(r => r.reward_type === 'title' && r.is_equipped)
  const equippedTheme = rewards.find(r => r.reward_type === 'theme' && r.is_equipped)
  const relicCount = rewards.length

  useEffect(() => {
    Object.values(THEME_KEY_TO_CLASS).forEach(cls => document.body.classList.remove(cls))
    if (equippedTheme) {
      const cls = THEME_KEY_TO_CLASS[equippedTheme.reward_key]
      if (cls) document.body.classList.add(cls)
    }
  }, [equippedTheme])

  return (
    <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: `${T.bg}f0`, backdropFilter: 'blur(10px)',
      borderBottom: `1px solid ${T.border}`,
      height: 54, padding: '0 12px',
      display: 'flex', alignItems: 'center', gap: 0,
    }}>
      <span style={{ fontFamily: T.serif, fontSize: 21, color: T.text, marginRight: 28, letterSpacing: '-0.3px' }}>
        Goal<span style={{ color: T.orange }}>Forge</span>
      </span>

      {(['dashboard', 'analytics', 'settings'] as const).map(v => (
        <Link key={v} to={`/${v}`} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          height: 54, padding: '0 14px', fontFamily: T.mono, fontSize: 12,
          letterSpacing: '0.04em', display: 'flex', alignItems: 'center',
          color: location.pathname === `/${v}` ? T.text : T.muted,
          borderBottom: location.pathname === `/${v}` ? `2px solid ${T.orange}` : '2px solid transparent',
          textDecoration: 'none',
        }}>
          {v}
        </Link>
      ))}

      <button
        onClick={() => navigate('/analytics')}
        aria-label={`${pts} star points, stage ${stage.name}. Go to analytics.`}
        style={{
          marginLeft: 14,
          background: `${stage.color}18`, border: `1px solid ${stage.color}40`,
          borderRadius: 18, padding: '4px 11px', cursor: 'pointer',
          fontFamily: T.mono, fontSize: 11, color: stage.color,
        }}
        className="hidden sm:flex items-center gap-[5px]"
      >
        ✦ {pts} pts · {stage.name}
      </button>

      {equippedTitle && (
        <span style={{
          marginLeft: 8,
          fontFamily: T.mono, fontSize: 10,
          color: '#fbbf24', background: '#fbbf2415',
          border: '1px solid #fbbf2440',
          padding: '2px 8px', borderRadius: 99,
        }} className="hidden sm:inline">
          {equippedTitle.display_name}
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {relicCount > 0 && onOpenCollection && (
          <button
            onClick={onOpenCollection}
            aria-label={`${relicCount} collected relics. Open Trophy Room.`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: T.mono, fontSize: 11, color: '#a78bfa',
              padding: '4px 8px', minHeight: 44,
            }}
            className="hidden sm:flex items-center"
          >
            🏆 {relicCount} Rare {relicCount === 1 ? 'Relic' : 'Relics'}
          </button>
        )}

        {user?.firstName && (
          <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }} className="hidden sm:inline">
            {user.firstName}
          </span>
        )}
        <UserButton />
      </div>
    </div>
    </>
  )
}
