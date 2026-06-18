import { useEffect, useRef } from 'react'

// Layered idle Solly: a lightweight transparent PNG bobs during cooldown
// (cheap, GPU-composited); the transparent webm fades in and plays once every
// ~7–16s, then crossfades back to the PNG. Disabled under reduced motion.
export default function SollyIdle({ className }: { className?: string }) {
  const vidRef = useRef<HTMLVideoElement>(null)
  const restRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const video = vidRef.current, rest = restRef.current
    if (!video) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let timer: ReturnType<typeof setTimeout>
    let alive = true
    video.muted = true
    const showClip = (on: boolean) => {
      video.style.opacity = on ? '1' : '0'
      if (rest) rest.style.opacity = on ? '0' : '1'
    }
    const playOnce = () => {
      if (!alive) return
      try { video.currentTime = 0 } catch { /* ignore */ }
      showClip(true)
      const p = video.play()
      if (p && p.catch) p.catch(() => showClip(false))
    }
    const schedule = () => { if (alive) timer = setTimeout(playOnce, 7000 + Math.random() * 9000) }
    const onEnded = () => {
      showClip(false)
      try { video.currentTime = 0 } catch { /* ignore */ }
      schedule()
    }
    video.addEventListener('ended', onEnded)
    if (!reduce) schedule()
    return () => {
      alive = false
      clearTimeout(timer)
      video.removeEventListener('ended', onEnded)
      video.pause()
    }
  }, [])
  return (
    <div className={className}>
      <img ref={restRef} className="solly-rest" src="/solly/solly.png" alt="Solly" />
      <video ref={vidRef} className="solly-clip" muted playsInline preload="auto" aria-hidden="true">
        <source src="/solly/solly-idle-alpha.webm" type="video/webm" />
      </video>
    </div>
  )
}
