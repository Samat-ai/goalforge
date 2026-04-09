import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { T } from '../lib/theme'

// Lowest-tier Speck creature (stage 0, pts=0) rendered inline as a static sad version
function SadCreature({ size = 160 }: { size?: number }) {
  const uid = useId()
  const cx = size / 2, cy = size / 2
  const c = '#4a4a6a'
  const outerR = size * 0.22
  const innerR = size * 0.09
  const nPoints = 5

  const starVerts: [number, number][] = []
  for (let i = 0; i < nPoints * 2; i++) {
    const angle = (i * Math.PI) / nPoints - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    starVerts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  const starPath =
    starVerts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z'

  const eyeY = cy - outerR * 0.18
  const eyeOff = outerR * 0.28
  // Sad downward curve
  const sy = cy + outerR * 0.3
  const sw = outerR * 0.4

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`glow404_${uid}`}>
          <stop offset="0%" stopColor={c} stopOpacity="0.18" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`body404_${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#6b6b8a" stopOpacity="0.95" />
          <stop offset="100%" stopColor={c} stopOpacity="1" />
        </radialGradient>
      </defs>

      <ellipse
        cx={cx}
        cy={cy}
        rx={outerR * 1.8}
        ry={outerR * 1.8}
        fill={`url(#glow404_${uid})`}
      />

      <path d={starPath} fill={`url(#body404_${uid})`} stroke={c} strokeWidth="0.5" />

      {/* Eyes — small dots, looking down (sad) */}
      <ellipse cx={cx - eyeOff} cy={eyeY} rx={3} ry={3} fill="#9090b0" opacity="0.8" />
      <ellipse cx={cx + eyeOff} cy={eyeY} rx={3} ry={3} fill="#9090b0" opacity="0.8" />

      {/* Sad mouth — frown */}
      <path
        d={`M ${cx - sw} ${sy} Q ${cx} ${sy - 6} ${cx + sw} ${sy}`}
        fill="none"
        stroke="#6b6b8a"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Teardrop */}
      <ellipse cx={cx - eyeOff + 2} cy={eyeY + 10} rx={1.5} ry={3} fill="#818cf8" opacity="0.5" />
    </svg>
  )
}

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div
      className="mesh-bg min-h-dvh"
      style={{
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        fontFamily: T.serif,
      }}
    >
      {/* Floating creature */}
      <div className="animate-float" style={{ marginBottom: 24 }}>
        <SadCreature size={160} />
      </div>

      {/* 404 number */}
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          fontFamily: T.mono,
          color: T.indigo,
          lineHeight: 1,
          marginBottom: 20,
          textShadow: `0 0 40px ${T.indigo}55, 0 0 80px ${T.indigo}22`,
          letterSpacing: '-0.04em',
        }}
      >
        404
      </div>

      {/* Headline */}
      <h1
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: T.text,
          marginBottom: 12,
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        This page went off the map
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontSize: 15,
          color: T.textDim,
          textAlign: 'center',
          maxWidth: 380,
          lineHeight: 1.7,
          marginBottom: 36,
        }}
      >
        The goal you're looking for doesn't exist — but yours does.
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => window.history.back()}
          style={{
            cursor: 'pointer',
            padding: '11px 24px',
            borderRadius: 10,
            fontFamily: T.mono,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            background: 'transparent',
            color: T.textDim,
            border: `1px solid ${T.border}`,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = T.borderHi
            e.currentTarget.style.color = T.text
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = T.border
            e.currentTarget.style.color = T.textDim
          }}
        >
          ← Back
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          style={{
            cursor: 'pointer',
            padding: '11px 24px',
            borderRadius: 10,
            fontFamily: T.mono,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            background: T.indigo,
            color: '#fff',
            border: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  )
}
