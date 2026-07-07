// gf/AppShell.tsx — app shell: header, nav, root wrapper. Transcribed from
// design_handoff_goalforge/app/gf-app.jsx's Header + App root, minus the
// tweaks panel, confetti burst (handled by ConfettiProvider/canvas-confetti
// already wired in main.tsx), and page-switch state (react-router owns
// routing here via <Outlet/> instead of the prototype's in-memory `tab`).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/react'
import { Icon } from './Ui'
import { cx } from './util'
import { getStage } from '../../lib/gamification'
import { useProfileQuery } from '../../hooks'
import { useResolvedTheme } from '../../lib/ThemeContext'

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement after layout
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

// Router-aware port of the prototype's page-level <Switcher value={tab} scrollTop>
// (gf-app.jsx): exit→enter cross-fade on route change, single entrance animation.
// The outgoing page keeps rendering (frozen element snapshot) during the 160ms
// out-phase; __gfRevealOff stops inner Reveals from replaying on later switches.
function PageSwitcher() {
  const location = useLocation()
  const outlet = useOutlet()
  const [shown, setShown] = useState<{ key: string; el: ReactNode }>(() => ({ key: location.pathname, el: outlet }))
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const reduce = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (location.pathname === shown.key) return
    window.__gfRevealOff = true
    // Two-phase exit→enter transition — effect-driven by design (see Ui.tsx Switcher).
     
    if (reduce.current) { setShown({ key: location.pathname, el: outlet }); return }
    setPhase('out')
    const id = setTimeout(() => {
      setShown({ key: location.pathname, el: outlet })
      setPhase('in')
      // The app's scroll container is <body> (html{overflow:hidden}) — reset both.
      window.scrollTo({ top: 0, behavior: 'instant' })
      document.body.scrollTop = 0
    }, 160)
     
    return () => clearTimeout(id)
    // `outlet`/`shown` intentionally omitted: the swap is keyed on the route only;
    // re-running on them would cancel an in-flight transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  return <div className={cx('gf-xfade', phase === 'out' ? 'is-out' : 'is-in')}>{shown.el}</div>
}

export default function AppShell() {
  // The prototype root ships with these variant attributes baked in
  // (data-theme + data-create/font/motion/density — see the .gf-root element in
  // design_handoff_goalforge/app/GoalForge Redesign.html). The tweaks panel that
  // toggled them was dropped, so the shipped defaults are hard-coded here.
  // data-theme is mirrored from ThemeContext because index.css has compound
  // selectors ([data-theme="dark"][data-create="glass"]) that require both
  // attributes on the same element.
  const resolved = useResolvedTheme()
  return (
    <div className="gf-root" data-theme={resolved} data-create="glass" data-font="modern" data-motion="rich" data-density="cozy">
      <Header />
      <main className="gf-main">
        <PageSwitcher />
      </main>
    </div>
  )
}
