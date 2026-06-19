import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

const NAV = ['dashboard', 'analytics', 'stars', 'coach', 'settings'] as const
// `coach` is labeled "Chat" in the UI — keep the route id, change the display only.
const LABEL: Record<(typeof NAV)[number], string> = {
  dashboard: 'Dashboard', analytics: 'Analytics', stars: 'Logs', coach: 'Chat', settings: 'Settings',
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

  // ── animated nav pill ──────────────────────────────────────────────
  const navRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false })
  const active = NAV.find(v => location.pathname === `/${v}`)

  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(`[data-nav="${active}"]`)
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
    else setPill(p => ({ ...p, ready: false }))
  }, [active])

  useEffect(() => {
    const onResize = () => {
      const el = navRef.current?.querySelector<HTMLElement>(`[data-nav="${active}"]`)
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: `color-mix(in oklab, ${T.bg} 72%, transparent)`,
        backdropFilter: 'blur(16px) saturate(1.4)',
        borderBottom: `1px solid ${T.border}`,
        height: 62, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <span style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 600, color: T.text, letterSpacing: '-0.02em' }}>
          Goal<span style={{ color: T.orange }}>Forge</span>
        </span>

        {/* nav: relative container + one absolutely-positioned pill behind the links */}
        <nav
          ref={navRef}
          style={{
            position: 'relative', display: 'flex', alignItems: 'center', gap: 2,
            padding: 4, borderRadius: 99,
            background: `color-mix(in oklab, ${T.text} 5%, transparent)`,
            border: `1px solid ${T.border}`,
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute', top: 4, bottom: 4, left: 0,
              transform: `translateX(${pill.left}px)`, width: pill.width,
              borderRadius: 99, background: T.cardHi,
              boxShadow: '0 1px 2px rgba(0,0,0,.4), 0 14px 40px -22px rgba(0,0,0,.7)',
              opacity: pill.ready ? 1 : 0, willChange: 'transform, width',
              transition: 'transform .44s cubic-bezier(.4,0,.2,1), width .44s cubic-bezier(.4,0,.2,1), opacity .25s ease',
            }}
          />
          {NAV.map(v => {
            const on = location.pathname === `/${v}`
            return (
              <Link
                key={v}
                to={`/${v}`}
                data-nav={v}
                style={{
                  position: 'relative', zIndex: 1,
                  display: 'flex', alignItems: 'center',
                  height: 36, padding: '0 14px', borderRadius: 99,
                  fontFamily: T.serif, fontSize: 13.5, fontWeight: 500,
                  color: on ? T.text : T.textMute,
                  textDecoration: 'none', transition: 'color .2s',
                }}
              >
                {LABEL[v]}
              </Link>
            )
          })}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/analytics')}
            aria-label={`${pts} star points, stage ${stage.name}. Go to analytics.`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
              borderRadius: 99, cursor: 'pointer',
              background: `${stage.color}18`, border: `1px solid ${stage.color}40`,
              fontFamily: T.mono, fontSize: 12, fontWeight: 500, color: stage.color,
            }}
            className="hidden sm:flex"
          >
            ✦ {pts} · {stage.name}
          </button>

          {equippedTitle && (
            <span style={{
              fontFamily: T.mono, fontSize: 10, color: T.amber,
              background: `${T.amber}15`, border: `1px solid ${T.amber}40`,
              padding: '2px 8px', borderRadius: 99,
            }} className="hidden sm:inline">
              {equippedTitle.display_name}
            </span>
          )}

          {relicCount > 0 && onOpenCollection && (
            <button
              onClick={onOpenCollection}
              aria-label={`${relicCount} collected relics. Open Trophy Room.`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: T.mono, fontSize: 11, color: T.indigo,
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
