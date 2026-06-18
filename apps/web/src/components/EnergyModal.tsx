interface EnergyModalProps {
  onConfirm: () => void
  onDismiss: () => void
  isLoading?: boolean
}

export default function EnergyModal({ onConfirm, onDismiss, isLoading }: EnergyModalProps) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label="Low energy mode"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.80)', animation: 'fadeInBg 0.2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div style={{
        background: 'var(--card-2)',
        border: '1px solid color-mix(in oklab, var(--indigo) 27%, transparent)',
        borderRadius: 16, padding: '32px 28px', textAlign: 'center',
        maxWidth: 340, width: '90%',
        boxShadow: '0 0 60px color-mix(in oklab, var(--indigo) 13%, transparent)',
        animation: 'modalPop 0.45s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>
          Low energy today?
        </h2>

        <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, margin: '0 0 24px' }}>
          We&apos;ll break today&apos;s tasks into tiny first steps — each under 3 minutes. No pressure, just momentum.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
              padding: '12px 0', cursor: isLoading ? 'not-allowed' : 'pointer',
              minHeight: 44, opacity: isLoading ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
          >
            {isLoading ? 'Simplifying…' : "Simplify today’s tasks"}
          </button>

          <button
            onClick={onDismiss}
            disabled={isLoading}
            style={{
              background: 'transparent', color: 'var(--text-mute)',
              border: '1px solid var(--border)', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
              padding: '10px 0', cursor: isLoading ? 'not-allowed' : 'pointer', minHeight: 44,
            }}
          >
            I&apos;m fine, thanks
          </button>
        </div>
      </div>
    </div>
  )
}
