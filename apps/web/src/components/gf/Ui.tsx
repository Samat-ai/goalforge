// gf/Ui.tsx — shared primitives for the GoalForge redesign, transcribed from
// design_handoff_goalforge/app/gf-ui.jsx. Prop names/behavior kept verbatim;
// only the window-attachment + Switcher-only bits (not used by this app) are
// dropped. See design_handoff_goalforge/app/gf-ui.jsx for the source of truth.
// Non-component helpers (cx, ICONS, gfTip/gfHideTip, useCountUp, useInView) live
// in ./util — react-refresh/only-export-components requires this file to only
// export components for Fast Refresh to work.
import { useEffect, useId, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { cx, ICONS } from './util'

export function Icon({
  name, size = 18, stroke = 1.75, style, className,
}: {
  name: string
  size?: number
  stroke?: number
  style?: CSSProperties
  className?: string
}) {
  const inner = ICONS[name] || ''
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      // pointerEvents none: icons are decorative (aria-hidden) and always sit inside
      // interactive elements. Without this, a re-render between mousedown and mouseup
      // (e.g. input blur) replaces the innerHTML path node and Chrome suppresses the
      // click entirely (mousedown target disconnected). Deviation from the prototype
      // (which has the same latent bug); visual output identical.
      style={{ display: 'block', flexShrink: 0, pointerEvents: 'none', ...style }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

export function Reveal({
  children, delay = 0, className, style, as = 'div',
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  style?: CSSProperties
  as?: ElementType
}) {
  const El = as
  return (
    <El className={cx('gf-reveal', className)} style={{ ...style, animationDelay: `${Math.max(delay, 40)}ms` }}>
      {children}
    </El>
  )
}

// ── Progress ring (animated draw-on) ────────────────────────────────────────
export function Ring({
  value, size = 120, stroke = 12, color = 'var(--accent)', track = 'var(--ring-track)', children, delay = 120, rounded = true, fromRatio = 0,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
  delay?: number
  rounded?: boolean
  gradientId?: string
  fromRatio?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  // Start partially drawn (fromRatio) so it settles the last stretch smoothly
  // instead of sweeping all the way from empty.
  const [p, setP] = useState(value * fromRatio)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Synchronizing with the external prefers-reduced-motion media query, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reduce) { setP(value); return }
    const id = setTimeout(() => setP(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  const dur = fromRatio > 0 ? '0.9s' : '1.1s'
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap={rounded ? 'round' : 'butt'} strokeDasharray={c}
          strokeDashoffset={c - (c * Math.max(0, Math.min(1, p)))}
          style={{ transition: `stroke-dashoffset ${dur} cubic-bezier(.22,.61,.36,1)` }}
        />
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>}
    </div>
  )
}

// ── Flame streak chip ───────────────────────────────────────────────────────
export function Flame({ n, size = 13, color = 'var(--accent)', muted }: { n: number; size?: number; color?: string; muted?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: muted ? 'var(--text-mute)' : color, fontWeight: 600 }}>
      <Icon name="flame" size={size} />{n}
    </span>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ data, w = 120, h = 36, color = 'var(--accent)', fill = true }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
  const max = Math.max(...data, 1), min = Math.min(...data, 0)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - 4 - ((v - min) / (max - min || 1)) * (h - 8)
    return [x, y] as const
  })
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  // useId is the ESLint-clean equivalent of the prototype's Math.random() id
  // (impure-function-in-render is banned project-wide) — same fix as GoalCard's PuffyStar.
  const gid = 'sp' + useId()
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} />
    </svg>
  )
}

// ── Mascot (geometric spark companion that evolves by stage) ────────────────
export function Mascot({ stageId = 3, size = 96 }: { stageId?: number; size?: number; mood?: string }) {
  // built from circles + a soft glow — no illustration
  const hue = ['#8a8aa8', '#f97316', '#fb923c', '#fbbf24', '#7dd3fc', '#a5f3fc'][stageId] || 'var(--accent)'
  return (
    <div style={{ position: 'relative', width: size, height: size }} className="gf-float">
      <div style={{ position: 'absolute', inset: '8%', borderRadius: '50%', background: `radial-gradient(circle at 38% 32%, ${hue}, ${hue}00 72%)`, filter: 'blur(2px)', opacity: 0.9 }} className="gf-glow" />
      <div style={{ position: 'absolute', inset: '20%', borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, #fff5, ${hue})`, boxShadow: `0 8px 30px ${hue}66, inset 0 -6px 14px ${hue}88` }} />
      {/* eyes */}
      <div style={{ position: 'absolute', left: '38%', top: '46%', width: size * 0.06, height: size * 0.09, borderRadius: 99, background: '#1a1320' }} />
      <div style={{ position: 'absolute', left: '56%', top: '46%', width: size * 0.06, height: size * 0.09, borderRadius: 99, background: '#1a1320' }} />
      {/* sparkle */}
      <div style={{ position: 'absolute', right: '10%', top: '6%', color: hue }} className="gf-twinkle"><Icon name="spark" size={size * 0.2} /></div>
    </div>
  )
}

// ── Segmented control with sliding pill ─────────────────────────────────────
export function Segmented<T extends string>({
  options, value, onChange, getLabel,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  getLabel?: (o: T) => string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false })
  useEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-seg="${value}"]`)
    // DOM measurement (offsetLeft/offsetWidth) after layout, same pattern as AppShell's nav pill.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
  }, [value, options])
  return (
    <div ref={wrap} className="gf-seg">
      <div className="gf-seg-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: pill.ready ? 1 : 0 }} />
      {options.map(o => (
        <button key={o} data-seg={o} className={cx('gf-seg-btn', value === o && 'is-active')} onClick={() => onChange(o)}>
          {getLabel ? getLabel(o) : o}
        </button>
      ))}
    </div>
  )
}

// ── iOS-style toggle switch ──────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; id?: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} id={id}
      className={cx('gf-switch', checked && 'is-on')} onClick={() => onChange(!checked)}>
      <span className="gf-switch-knob" />
    </button>
  )
}
