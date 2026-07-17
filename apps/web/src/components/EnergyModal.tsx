import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface EnergyModalProps {
  onConfirm: () => void
  onDismiss: () => void
  isLoading?: boolean
}

export default function EnergyModal({ onConfirm, onDismiss, isLoading }: EnergyModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isLoading) onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLoading, onDismiss])

  // Portaled to document.body: PageSwitcher's .gf-xfade wrapper sets
  // will-change: transform, which would otherwise become the containing block
  // for this fixed scrim and pin it to the page box instead of the viewport
  // (docs/CONVENTIONS.md portal pattern).
  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Low energy mode"
      className="gf-energy-scrim"
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div className="gf-energy">
        <img src="/solly/solly-tired.svg" className="gf-energy-solly" alt="" width={64} height={64} />
        <div className="gf-energy-kicker">✦ LOW ENERGY MODE</div>
        <h2>Low energy today?</h2>
        <p>
          We&apos;ll break today&apos;s tasks into tiny first steps — each under 3 minutes.
          No pressure, just momentum.
        </p>
        <div className="gf-energy-btns">
          <button onClick={onConfirm} disabled={isLoading} className="gf-energy-confirm">
            {isLoading ? 'Simplifying…' : "Simplify today's tasks"}
          </button>
          <button onClick={onDismiss} disabled={isLoading} className="gf-energy-dismiss">
            I&apos;m fine, thanks
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
