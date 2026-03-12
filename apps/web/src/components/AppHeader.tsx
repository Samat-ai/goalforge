import { Link, useLocation, useNavigate } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/react'
import { getStage } from '../lib/gamification'

const T = {
  bg: "#07070f", border: "#1c1c30", orange: "#f97316",
  muted: "#71717a", text: "#e8e8f0",
  serif: "'Plus Jakarta Sans', sans-serif", mono: "'JetBrains Mono', monospace",
}

interface AppHeaderProps {
  pts: number
}

export default function AppHeader({ pts }: AppHeaderProps) {
  const location = useLocation()
  const navigate  = useNavigate()
  const { user }  = useUser()
  const stage     = getStage(pts)

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 100,
      background: `${T.bg}f0`, backdropFilter: "blur(10px)",
      borderBottom: `1px solid ${T.border}`,
      height: 54, padding: "0 12px",
      display: "flex", alignItems: "center", gap: 0,
    }}>
      <span style={{ fontFamily: T.serif, fontSize: 21, color: T.text, marginRight: 28, letterSpacing: "-0.3px" }}>
        Goal<span style={{ color: T.orange }}>Forge</span>
      </span>

      {(["dashboard", "analytics"] as const).map(v => (
        <Link key={v} to={`/${v}`} style={{
          background: "none", border: "none", cursor: "pointer",
          height: 54, padding: "0 14px", fontFamily: T.mono, fontSize: 12,
          letterSpacing: "0.04em", display: "flex", alignItems: "center",
          color: location.pathname === `/${v}` ? T.text : T.muted,
          borderBottom: location.pathname === `/${v}` ? `2px solid ${T.orange}` : "2px solid transparent",
          textDecoration: "none",
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
          borderRadius: 18, padding: "4px 11px", cursor: "pointer",
          fontFamily: T.mono, fontSize: 11, color: stage.color,
        }}
        className="hidden sm:flex items-center gap-[5px]"
      >
        ✦ {pts} pts · {stage.name}
      </button>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {user?.firstName && (
          <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }} className="hidden sm:inline">{user.firstName}</span>
        )}
        <UserButton />
      </div>
    </div>
  )
}
