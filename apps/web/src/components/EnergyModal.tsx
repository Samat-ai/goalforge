import { useT } from '../lib/theme'

interface EnergyModalProps {
  onConfirm: () => void
  onDismiss: () => void
  isLoading?: boolean
}

/**
 * Full-screen modal shown when the user arrives via ?energy=low or clicks the
 * TodayBar "Low energy" button. Does NOT call useEnergyResizeMutation internally
 * — accepts onConfirm from Dashboard per the mutation-prop-lifting pattern.
 */
export default function EnergyModal({ onConfirm, onDismiss, isLoading }: EnergyModalProps) {
  const T = useT()
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Low energy mode"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.80)',
        animation: 'fadeInBg 0.2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div style={{
        background: T.card2,
        border: `1px solid ${T.indigo}44`,
        borderRadius: 16,
        padding: '32px 28px',
        textAlign: 'center',
        maxWidth: 340,
        width: '90%',
        boxShadow: `0 0 60px ${T.indigo}22`,
        animation: 'modalPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>

        {/* Heading */}
        <h2 style={{
          fontFamily: T.serif, fontSize: 20, fontWeight: 700,
          color: T.text, margin: '0 0 10px',
        }}>
          Low energy today?
        </h2>

        {/* Body */}
        <p style={{
          fontFamily: T.serif, fontSize: 14, color: T.textDim,
          lineHeight: 1.6, margin: '0 0 24px',
        }}>
          We'll break today's tasks into tiny first steps — each under 3 minutes.
          No pressure, just momentum.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontFamily: T.mono,
              fontSize: 13,
              fontWeight: 700,
              padding: '12px 0',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              minHeight: 44,
              opacity: isLoading ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {isLoading ? 'Simplifying\u2026' : "Simplify today\u2019s tasks"}
          </button>

          <button
            onClick={onDismiss}
            disabled={isLoading}
            style={{
              background: 'transparent',
              color: T.muted,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontFamily: T.mono,
              fontSize: 12,
              fontWeight: 600,
              padding: '10px 0',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              minHeight: 44,
            }}
          >
            I'm fine, thanks
          </button>
        </div>
      </div>
    </div>
  )
}
