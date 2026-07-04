// gf/AppShell.tsx — app shell: header, nav, root wrapper. Transcribed from
// design_handoff_goalforge/app/gf-app.jsx's Header + App root, minus the
// tweaks panel, confetti burst (handled by ConfettiProvider/canvas-confetti
// already wired in main.tsx), and page-switch state (react-router owns
// routing here via <Outlet/> instead of the prototype's in-memory `tab`).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/react'
import { cx, Icon } from './Ui'
import { getStage } from '../../lib/gamification'
import { useProfileQuery } from '../../hooks'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'stars', label: 'Logs', icon: 'spark' },
  { id: 'coach', label: 'Chat', icon: 'chat' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
] as const

function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  const { pts } = useProfileQuery(user?.id ?? undefined)
  const stage = getStage(pts)

  const active = NAV.find(n => location.pathname === `/${n.id}`)?.id

  const wrap = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false })
  const [menuOpen, setMenuOpen] = useState(false)

  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-nav="${active}"]`)
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
    else setPill(p => ({ ...p, ready: false }))
  }, [active])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 700) setMenuOpen(false)
      const el = wrap.current?.querySelector<HTMLElement>(`[data-nav="${active}"]`)
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [active])

  const pick = (id: string) => { navigate(`/${id}`); setMenuOpen(false) }

  return (
    <header className="gf-header">
      <div className="gf-header-in">
        <div className="gf-logo">Goal<span>Forge</span></div>
        <nav className="gf-nav" ref={wrap}>
          <div className="gf-nav-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: pill.ready ? 1 : 0 }} />
          {NAV.map(n => (
            <Link key={n.id} to={`/${n.id}`} data-nav={n.id} className={cx('gf-nav-btn', active === n.id && 'is-active')}>
              <Icon name={n.icon} size={15} /><span className="gf-nav-label">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="gf-header-right">
          <button className="gf-pts" onClick={() => navigate('/analytics')} aria-label={`Stage ${stage.name}. Go to analytics.`}>
            <Icon name="spark" size={12} /> <span className="gf-pts-stage">{stage.name}</span>
          </button>
          <UserButton />
          <button
            className={cx('gf-burger', menuOpen && 'is-open')}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      {menuOpen && <div className="gf-navmenu-scrim" onClick={() => setMenuOpen(false)} />}
      <div className={cx('gf-navmenu', menuOpen && 'is-open')}>
        {NAV.map(n => (
          <button key={n.id} className={cx('gf-navmenu-btn', active === n.id && 'is-active')} onClick={() => pick(n.id)}>
            <Icon name={n.icon} size={18} /><span>{n.label}</span>
          </button>
        ))}
      </div>
    </header>
  )
}

export default function AppShell() {
  return (
    <div className="gf-root">
      <Header />
      <main className="gf-main">
        <Outlet />
      </main>
    </div>
  )
}
