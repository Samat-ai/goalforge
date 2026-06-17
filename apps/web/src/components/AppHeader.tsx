import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/react'
import { getStage } from '../lib/gamification'
import { useT } from '../lib/theme'
import { useRewardsQuery } from '../hooks/useRewards'
import Icon from './ui/Icon'

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/stars', label: 'Logs', icon: 'spark' },
  { to: '/coach', label: 'Chat', icon: 'chat' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
] as const

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
  const T = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  const stage = getStage(pts)

  const navRef = useRef<HTMLElement>(null)
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false })
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (to: string) =>
    location.pathname === to || (to === '/dashboard' && location.pathname === '/')

  // Slide the nav pill under the active tab.
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[data-nav-active="true"]')
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
  }, [location.pathname])

  // Close mobile menu on resize-up / Escape.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 700) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey) }
  }, [])

  const { data: rewards = [] } = useRewardsQuery(user?.id ?? '')
  const equippedTitle = rewards.find(r => r.reward_type === 'title' && r.is_equipped)
  const equippedTheme = rewards.find(r => r.reward_type === 'theme' && r.is_equipped)
  const relicCount = rewards.length

  // Apply equipped reward-theme body class (unchanged from before).
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
      <header className="gf-header">
        <div className="gf-header-in">
          <div className="gf-logo">Goal<span>Forge</span></div>

          <nav className="gf-nav" ref={navRef} aria-label="Primary">
            <div
              className="gf-nav-pill"
              style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: pill.ready ? 1 : 0 }}
            />
            {NAV.map(({ to, label, icon }) => {
              const active = isActive(to)
              return (
                <Link key={to} to={to} data-nav-active={active} className={cx('gf-nav-btn', active && 'is-active')}>
                  <Icon name={icon} size={15} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="gf-header-right">
            <button
              onClick={() => navigate('/analytics')}
              aria-label={`${pts} star points, stage ${stage.name}. Go to analytics.`}
              className="gf-pts"
            >
              <Icon name="spark" size={12} />
              {pts} pts · <span className="gf-pts-stage">{stage.name}</span>
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

            <button
              className={cx('gf-burger', menuOpen && 'is-open')}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {menuOpen && <div className="gf-navmenu-scrim" onClick={() => setMenuOpen(false)} />}
        <div className={cx('gf-navmenu', menuOpen && 'is-open')}>
          {NAV.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              className={cx('gf-navmenu-btn', isActive(to) && 'is-active')}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={icon} size={18} /><span>{label}</span>
            </Link>
          ))}
        </div>
      </header>
    </>
  )
}
