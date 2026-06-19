interface EnergyModalProps {
  onConfirm: () => void
  onDismiss: () => void
  isLoading?: boolean
}

export default function EnergyModal({ onConfirm, onDismiss, isLoading }: EnergyModalProps) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label="Low energy mode"
      className="gf-energy-scrim"
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div className="gf-energy">
        <div className="gf-energy-ic">⚡</div>
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
    </div>
  )
}
