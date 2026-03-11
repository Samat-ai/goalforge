import { useState, useEffect, useId } from 'react'
import { todayStr } from '../lib/gamification'

const T_DIM = "#3f3f5c"
const T_ORANGE = "#f97316"

// ── Animated Star Creature (companion) ────────────────────────────────────────
export function Creature({ pts, size = 180 }: { pts: number; size?: number }) {
  const [tick, setTick] = useState(0)
  const uid = useId()
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 80)
    return () => clearInterval(id)
  }, [])

  // Stage logic inline to avoid importing getStage here creating a cycle
  const STAGE_DEFS = [
    { id: 0, pts: 0,   color: "#4a4a6a" },
    { id: 1, pts: 30,  color: "#c2410c" },
    { id: 2, pts: 80,  color: "#f97316" },
    { id: 3, pts: 175, color: "#fbbf24" },
    { id: 4, pts: 350, color: "#bae6fd" },
    { id: 5, pts: 600, color: "#a5f3fc" },
  ]
  const stage = (() => {
    for (let i = STAGE_DEFS.length - 1; i >= 0; i--) {
      if (pts >= STAGE_DEFS[i].pts) return STAGE_DEFS[i]
    }
    return STAGE_DEFS[0]
  })()

  const S = stage.id
  const c = stage.color
  const cx = size / 2, cy = size / 2
  const pulse   = Math.sin(tick * 0.18) * 0.5 + 0.5
  const float   = Math.sin(tick * 0.12) * 3
  const outerR  = size * 0.22 + pulse * (S >= 3 ? 5 : 2)
  const innerR  = size * 0.09
  const nPoints = S >= 4 ? 8 : S >= 2 ? 6 : 5

  const starVerts: [number, number][] = []
  for (let i = 0; i < nPoints * 2; i++) {
    const angle = (i * Math.PI) / nPoints - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    starVerts.push([cx + r * Math.cos(angle), cy + float + r * Math.sin(angle)])
  }
  const starPath = starVerts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ") + "Z"

  const orbitCount = S >= 4 ? 5 : S >= 3 ? 4 : S >= 2 ? 3 : 0
  const orbits = Array.from({ length: orbitCount }, (_, i) => {
    const angle = tick * 0.04 + (i * 2 * Math.PI) / orbitCount
    const r = size * 0.32 + (i % 2) * 8
    return { x: cx + r * Math.cos(angle), y: cy + float + r * Math.sin(angle), r: 2.5 + (i % 2) }
  })

  const rayCount = S >= 5 ? 12 : S >= 3 ? 8 : 0
  const rays = Array.from({ length: rayCount }, (_, i) => {
    const angle = (i * Math.PI * 2) / rayCount + tick * 0.01
    return {
      x1: cx + outerR * 1.2 * Math.cos(angle),
      y1: cy + float + outerR * 1.2 * Math.sin(angle),
      x2: cx + outerR * (1.5 + pulse * 0.3) * Math.cos(angle),
      y2: cy + float + outerR * (1.5 + pulse * 0.3) * Math.sin(angle),
    }
  })

  const eyeY   = cy + float - outerR * 0.18
  const eyeOff = outerR * 0.28
  const blink  = pulse > 0.92 ? 1 : 5 + pulse * 2
  const eyeCol = S >= 4 ? "#0ea5e9" : S >= 2 ? "#fbbf24" : "#ffffff"
  const fillTop= S >= 4 ? "#ffffff" : S >= 3 ? "#fef9c3" : S >= 1 ? "#fed7aa" : "#6b6b8a"
  const glowR  = outerR * (1.8 + pulse * 0.4)
  const glowA  = (0.12 + pulse * 0.12) * 2

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id={`glow_${uid}`}>
          <stop offset="0%"   stopColor={c} stopOpacity={String(glowA)} />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`body_${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%"   stopColor={fillTop} stopOpacity="0.95" />
          <stop offset="100%" stopColor={c}       stopOpacity="1" />
        </radialGradient>
        <filter id={`blur_${uid}`}>
          <feGaussianBlur stdDeviation={S >= 3 ? "3" : "1.5"} />
        </filter>
      </defs>

      <ellipse cx={cx} cy={cy + float} rx={glowR} ry={glowR}
        fill={`url(#glow_${uid})`} filter={`url(#blur_${uid})`} />

      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke={c} strokeWidth={S >= 5 ? 2 : 1.5} strokeLinecap="round"
          opacity={String(0.5 + pulse * 0.4)} />
      ))}

      {orbits.map((o, i) => (
        <circle key={i} cx={o.x} cy={o.y} r={o.r}
          fill={c} opacity={String(0.6 + pulse * 0.3)} />
      ))}

      <path d={starPath} fill={`url(#body_${uid})`} stroke={c} strokeWidth="0.5" />

      {S >= 1 && <>
        <ellipse cx={cx - eyeOff} cy={eyeY} rx={4} ry={blink} fill={eyeCol} opacity="0.95" />
        <ellipse cx={cx + eyeOff} cy={eyeY} rx={4} ry={blink} fill={eyeCol} opacity="0.95" />
        {S >= 2 && <>
          <ellipse cx={cx - eyeOff + 0.8} cy={eyeY} rx={2} ry={blink * 0.6} fill="#07070f" opacity="0.8" />
          <ellipse cx={cx + eyeOff + 0.8} cy={eyeY} rx={2} ry={blink * 0.6} fill="#07070f" opacity="0.8" />
        </>}
        <circle cx={cx - eyeOff + 1.5} cy={eyeY - 1.5} r={1.2} fill="white" opacity="0.9" />
        <circle cx={cx + eyeOff + 1.5} cy={eyeY - 1.5} r={1.2} fill="white" opacity="0.9" />
      </>}

      {S >= 2 && (() => {
        const sy = cy + float + outerR * 0.3
        const sw = outerR * 0.4
        const sc = 4 + S * 2
        return <path d={`M ${cx - sw} ${sy} Q ${cx} ${sy + sc} ${cx + sw} ${sy}`}
          fill="none" stroke={eyeCol} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      })()}

      {S >= 4 && (() => {
        const ky = cy + float - outerR * 1.05
        const kw = outerR * 0.55
        return <g opacity="0.9">
          <path d={`M ${cx - kw} ${ky + 8} L ${cx - kw} ${ky} L ${cx - kw * 0.4} ${ky + 5} L ${cx} ${ky - 2} L ${cx + kw * 0.4} ${ky + 5} L ${cx + kw} ${ky} L ${cx + kw} ${ky + 8} Z`}
            fill={S >= 5 ? "#fbbf24" : "#f97316"} stroke="#fef3c7" strokeWidth="0.5" />
          <circle cx={cx}      cy={ky - 2} r={3} fill="#fef9c3" />
          <circle cx={cx - kw} cy={ky}     r={2} fill="#fef9c3" />
          <circle cx={cx + kw} cy={ky}     r={2} fill="#fef9c3" />
        </g>
      })()}

      {S >= 5 && Array.from({ length: 6 }, (_, i) => {
        const a = tick * 0.03 + i * Math.PI / 3
        const r = size * 0.38 + Math.sin(tick * 0.08 + i) * 6
        return <g key={i} opacity={String(0.6 + Math.sin(tick * 0.1 + i) * 0.3)}>
          <line x1={cx + r * Math.cos(a) - 3} y1={cy + float + r * Math.sin(a)}   x2={cx + r * Math.cos(a) + 3} y2={cy + float + r * Math.sin(a)}   stroke="#a5f3fc" strokeWidth="1" />
          <line x1={cx + r * Math.cos(a)}     y1={cy + float + r * Math.sin(a) - 3} x2={cx + r * Math.cos(a)}   y2={cy + float + r * Math.sin(a) + 3} stroke="#a5f3fc" strokeWidth="1" />
        </g>
      })}
    </svg>
  )
}

// ── Goal-card Star (brightness-based) ─────────────────────────────────────────
export function StarIcon({ b = 0.5, size = 52 }: { b?: number; size?: number }) {
  const uid = useId()
  const cx = size / 2, cy = size / 2, oR = size * 0.44, iR = size * 0.18
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 === 0 ? oR : iR
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + "Z"
  const hue  = b < 0.15 ? "#2a2a3a" : b < 0.5 ? `hsl(${20 + b * 20},60%,${15 + b * 20}%)` : `hsl(${38 + b * 7},95%,${32 + b * 33}%)`
  const glow = b > 0.15 ? `hsla(42,100%,60%,${b * 0.65})` : "transparent"
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return { x1: cx + oR * 1.15 * Math.cos(a), y1: cy + oR * 1.15 * Math.sin(a), x2: cx + oR * 1.5 * Math.cos(a), y2: cy + oR * 1.5 * Math.sin(a) }
  })
  return (
    <svg width={size} height={size} style={{ overflow: "visible", flexShrink: 0 }}>
      <defs>
        <radialGradient id={`sg_${uid}`}>
          <stop offset="0%"   stopColor={glow} stopOpacity="1" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`sf_${uid}`} cx="40%" cy="30%" r="70%">
          <stop offset="0%"   stopColor={b > 0.5 ? "#fff8e0" : hue} stopOpacity={String(b > 0.5 ? b * 0.9 : 0.3)} />
          <stop offset="100%" stopColor={hue}                        stopOpacity="1" />
        </radialGradient>
      </defs>
      {b > 0.15 && <ellipse cx={cx} cy={cy} rx={b * size * 0.52} ry={b * size * 0.52} fill={`url(#sg_${uid})`} />}
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="hsl(42,100%,70%)" strokeWidth="1.5" strokeLinecap="round"
          opacity={String(Math.max(0, (b - 0.6) / 0.4))} />
      ))}
      <path d={path} fill={`url(#sf_${uid})`}
        stroke={b < 0.15 ? T_DIM : `hsl(38,80%,${40 + b * 30}%)`}
        strokeWidth={b < 0.15 ? "1" : "0.5"} opacity={b < 0.05 ? "0.2" : "1"} />
      {b > 0.8 && <circle cx={cx} cy={cy - oR * 0.1} r={size * 0.04} fill="white" opacity={String((b - 0.8) * 5)} />}
    </svg>
  )
}

// ── 18-week Heatmap ───────────────────────────────────────────────────────────
export function Heatmap({ days }: { days: string[] }) {
  const cells = Array.from({ length: 18 * 7 }, (_, i) => {
    const w = 17 - Math.floor(i / 7)
    const day = i % 7
    const date = new Date(Date.now() - (w * 7 + day) * 864e5).toISOString().split("T")[0]
    return { date, done: days.includes(date), isToday: date === todayStr() }
  })
  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {cells.map(({ date, done, isToday }) => (
        <div key={date} title={date} style={{
          width: 11, height: 11, borderRadius: 2, flexShrink: 0,
          background: done ? T_ORANGE : T_DIM,
          opacity: done ? 1 : 0.35,
          border: isToday ? `1px solid ${T_ORANGE}` : "1px solid transparent",
        }} />
      ))}
    </div>
  )
}
