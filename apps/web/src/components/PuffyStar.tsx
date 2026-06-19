import { useId } from 'react'

// Brightness-driven star glyph (0–1). The radial gradient + glow intensify with brightness.
export default function PuffyStar({ brightness = 0.8, size = 46 }: { brightness?: number; size?: number }) {
  const uid = 'ps' + useId().replace(/:/g, '')
  const n = Math.max(0, Math.min(1, brightness))
  return (
    <div className="gf-puffy" style={{ width: size, height: size }}>
      <div className="gf-puffy-glow" style={{ background: `radial-gradient(circle, rgba(251,191,36,${0.12 + n * 0.3}) 30%, transparent 72%)` }} />
      <svg viewBox="0 0 100 100" width={size * 0.86} height={size * 0.86} style={{ position: 'relative', zIndex: 1, overflow: 'visible' }}>
        <defs>
          <radialGradient id={uid} cx="40%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="30%" stopColor="#FDE047" />
            <stop offset="70%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" stopOpacity={0.25 + n * 0.7} />
          </radialGradient>
        </defs>
        <polygon
          points="50,12 59.9,36.2 86.1,38.3 66.2,55.3 72.4,80.7 50,67 27.6,80.7 33.8,55.3 13.9,38.3 40.1,36.2"
          fill={`url(#${uid})`} stroke="rgba(251,191,36,0.35)" strokeWidth="1" strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
