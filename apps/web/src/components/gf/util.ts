// gf/util.ts — non-component helpers shared across the gf/* redesign components.
// Split out of Ui.tsx so that file only exports components (react-refresh/
// only-export-components requires component-only exports for Fast Refresh).
import { useEffect, useRef, useState } from 'react'

export const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ')

// One coherent line-icon family (Lucide geometry): uniform stroke, rounded caps
// & joins, no mixed filled/outline — so every glyph reads as one consistent system.
export const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V6"/><path d="M8 17v-4"/>',
  spark: '<path d="M12 3l1.9 5.1a2 2 0 0 0 1.1 1.1L20 11l-5 1.9a2 2 0 0 0-1.1 1.1L12 19l-1.9-5a2 2 0 0 0-1.1-1.1L4 11l5-1.9a2 2 0 0 0 1.1-1.1z"/>',
  chat: '<path d="M7.5 19.5A9 9 0 1 0 4 16l-1.4 4.2a.8.8 0 0 0 1 1z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2a1.6 1.6 0 0 1 1.6 1.4l.15 1a8 8 0 0 1 1.9 1.1l.95-.4a1.6 1.6 0 0 1 2 .7l.85 1.47a1.6 1.6 0 0 1-.4 2.05l-.8.62a8 8 0 0 1 0 2.2l.8.62a1.6 1.6 0 0 1 .4 2.05l-.85 1.47a1.6 1.6 0 0 1-2 .7l-.95-.4a8 8 0 0 1-1.9 1.1l-.15 1A1.6 1.6 0 0 1 12 22a1.6 1.6 0 0 1-1.6-1.4l-.15-1a8 8 0 0 1-1.9-1.1l-.95.4a1.6 1.6 0 0 1-2-.7l-.85-1.47a1.6 1.6 0 0 1 .4-2.05l.8-.62a8 8 0 0 1 0-2.2l-.8-.62a1.6 1.6 0 0 1-.4-2.05l.85-1.47a1.6 1.6 0 0 1 2-.7l.95.4a8 8 0 0 1 1.9-1.1l.15-1A1.6 1.6 0 0 1 12 2z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  bolt: '<path d="M13 2 4.3 12.5a1 1 0 0 0 .8 1.6H11l-1 7.9 8.7-10.6a1 1 0 0 0-.8-1.6H12z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  play: '<path d="M7 4.5a1 1 0 0 1 1.5-.86l11 7.5a1 1 0 0 1 0 1.72l-11 7.5A1 1 0 0 1 7 19.5z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22"/><path d="M14 14.6V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 4.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>',
  moon: '<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
  book: '<path d="M12 7v13"/><path d="M3.5 18A1.5 1.5 0 0 1 2 16.5V5a2 2 0 0 1 2-2h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4a2 2 0 0 1 2 2v11.5a1.5 1.5 0 0 1-1.5 1.5H16a3 3 0 0 0-4 1 3 3 0 0 0-4-1z"/>',
  run: '<path d="M22 12h-3.5l-2.5 7L10 4l-2.5 8H2"/>',
  brain: '<path d="M12 5a3 3 0 0 0-5.5-1.6A2.5 2.5 0 0 0 4 6a2.5 2.5 0 0 0-.5 4.5A2.5 2.5 0 0 0 5 15a2.5 2.5 0 0 0 4 2 3 3 0 0 0 3 1z"/><path d="M12 5a3 3 0 0 1 5.5-1.6A2.5 2.5 0 0 1 20 6a2.5 2.5 0 0 1 .5 4.5A2.5 2.5 0 0 1 19 15a2.5 2.5 0 0 1-4 2 3 3 0 0 1-3 1z"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2.5"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  alert: '<path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5"/><path d="M12 17.2h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
}
ICONS.fire = ICONS.flame

export const GOAL_ICON: Record<string, string> = { fitness: 'run', career: 'bolt', learning: 'book', wellness: 'heart' }

// ── Hooks ────────────────────────────────────────────────────────────────────
// Count-up number animation.
export function useCountUp(target: number, {
  duration = 1000, decimals = 0, start = true, fromRatio = 0.82,
}: { duration?: number; decimals?: number; start?: boolean; fromRatio?: number } = {}) {
  // Start near the target (default 82%) so big numbers settle gently over the
  // last stretch instead of spinning up from 0 like a slot machine.
  const startVal = Math.round(target * fromRatio)
  const [val, setVal] = useState(start ? startVal : target)
  const raf = useRef(0)
  useEffect(() => {
    // Synchronizing with the `start` prop / external prefers-reduced-motion media query, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!start) { setVal(target); return }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setVal(target); return }
    const t0 = performance.now()
    const base = target * fromRatio
    const span = target - base
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const e = 1 - Math.pow(1 - p, 4) // easeOutQuart — soft, decelerating settle
      setVal(base + span * e)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    // Safety: timers still fire (throttled) when rAF is paused/backgrounded,
    // so the number always settles on its true value.
    const safety = setTimeout(() => setVal(target), duration + 150)
    return () => { cancelAnimationFrame(raf.current); clearTimeout(safety) }
  }, [target, duration, start, fromRatio])
  return decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString()
}

// Reveal-on-scroll with stagger.
export function useInView({ threshold = 0.08 }: { threshold?: number } = {}) {
  const ref = useRef<HTMLElement | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    // Guard for a missing DOM ref (external system), mirrors the AppShell/Segmented measurement pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!el) { setSeen(true); return }
    let done = false
    const reveal = () => { if (!done) { done = true; setSeen(true) } }
    // Eager check — already in viewport on mount.
    const rect = el.getBoundingClientRect()
    if (rect.top < (window.innerHeight || 800) + 80) reveal()
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { reveal(); io.disconnect() } }, { threshold, rootMargin: '0px 0px -5% 0px' })
    io.observe(el)
    // Safety fallback so content never stays hidden if IO is flaky.
    const t = setTimeout(reveal, 700)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [threshold])
  return [ref, seen] as const
}

// ── Custom floating tooltip (replaces ugly native title rectangles) ────────
export function gfTip(e: { clientX: number; clientY: number }, html: string) {
  let tt = document.getElementById('gf-tip')
  if (!tt) {
    tt = document.createElement('div')
    tt.id = 'gf-tip'
    tt.className = 'gf-tip'
    ;(document.querySelector('.gf-root') || document.body).appendChild(tt)
  }
  tt.innerHTML = html
  tt.classList.add('show')
  const r = tt.getBoundingClientRect()
  let x = e.clientX + 14, y = e.clientY - r.height - 12
  if (x + r.width > window.innerWidth - 10) x = e.clientX - r.width - 14
  if (y < 8) y = e.clientY + 18
  tt.style.left = x + 'px'
  tt.style.top = y + 'px'
}

export function gfHideTip() {
  const tt = document.getElementById('gf-tip')
  if (tt) tt.classList.remove('show')
}
