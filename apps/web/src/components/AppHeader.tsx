import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/react'
import { getStage } from '../lib/gamification'
import { useRewardsQuery } from '../hooks/useRewards'

const THEME_KEY_TO_CLASS: Record<string, string> = {
  neon_cyberpunk: 'theme-neon-cyberpunk',
  matcha_green: 'theme-matcha-green',
  midnight_ocean: 'theme-midnight-ocean',
  sunset_ember: 'theme-sunset-ember',
}

const NAV = ['dashboard', 'analytics', 'stars', 'coach', 'settings'] as const
const LABEL: Record<(typeof NAV)[number], string> = {
  dashboard: 'Dashboard', analytics: 'Analytics', stars: 'Logs', coach: 'Chat', settings: 'Settings',
}

interface AppHeaderProps {
  pts: number
  onOpenCollection?: () => void
}

export default function AppHeader({ pts }: AppHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  const stage = getStage(pts)

  const { data: rewards = [] } = useRewardsQuery(user?.id ?? '')
  const equippedTheme = rewards.find(r => r.reward_type === 'theme' && r.is_equipped)

  // Apply equipped theme class to body
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

  // ── mobile burger ──────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 700) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const pickNav = (v: string) => {
    navigate(`/${v}`)
    setMenuOpen(false)
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="gf-header">
        <div className="gf-header-in">
          <span className="gf-logo">Goal<span>Forge</span></span>

          <nav className="gf-nav" ref={navRef}>
            <div
              className="gf-nav-pill"
              style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: pill.ready ? 1 : 0 }}
              aria-hidden
            />
            {NAV.map(v => (
              <Link
                key={v}
                to={`/${v}`}
                data-nav={v}
                className={`gf-nav-btn${active === v ? ' is-active' : ''}`}
              >
                {LABEL[v]}
              </Link>
            ))}
          </nav>

          <div className="gf-header-right">
            <button
              onClick={() => navigate('/analytics')}
              aria-label={`Stage ${stage.name}. Go to analytics.`}
              className="gf-pts"
            >
              ✦ <span className="gf-pts-stage">{stage.name}</span>
            </button>

            <UserButton />

            <button
              className={`gf-burger${menuOpen ? ' is-open' : ''}`}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>

        {menuOpen && <div className="gf-navmenu-scrim" onClick={() => setMenuOpen(false)} />}
        <div className={`gf-navmenu${menuOpen ? ' is-open' : ''}`}>
          {NAV.map(v => (
            <button
              key={v}
              className={`gf-navmenu-btn${active === v ? ' is-active' : ''}`}
              onClick={() => pickNav(v)}
            >
              <span>{LABEL[v]}</span>
            </button>
          ))}
        </div>
      </header>
    </>
  )
}
