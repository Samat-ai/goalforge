import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { T } from '../lib/theme'

interface EnergyModalProps {
  onConfirm: () => void
  onDismiss: () => void
  isLoading?: boolean
  /** When true the modal renders a Pro upgrade gate instead of the confirm flow */
  isProGated?: boolean
}

/**
 * Full-screen modal shown when the user arrives via ?energy=low or clicks the
 * TodayBar "Low energy" button. Does NOT call useEnergyResizeMutation internally
 * — accepts onConfirm from Dashboard per the mutation-prop-lifting pattern.
 */
export default function EnergyModal({ onConfirm, onDismiss, isLoading, isProGated = false }: EnergyModalProps) {
  const navigate = useNavigate()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isProGated ? 'Energy Mode — Pro feature' : 'Low energy mode'}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.80)',
        animation: 'fadeInBg 0.2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div style={{
        background: 'linear-gradient(160deg, #130d24 0%, #0f0f1a 100%)',
        border: isProGated ? `1px solid ${T.indigo}44` : '1px solid #7c3aed44',
        borderRadius: 16,
        padding: '32px 28px',
        textAlign: 'center',
        maxWidth: 340,
        width: '90%',
        boxShadow: isProGated ? `0 0 60px ${T.indigo}22` : '0 0 60px #7c3aed22',
        animation: 'modalPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {isProGated ? (
          <>
            {/* Pro gate content */}
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `${T.indigo}18`, border: `1px solid ${T.indigo}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <Lock size={26} color={T.indigo} />
            </div>

            <h2 style={{
              fontFamily: T.serif, fontSize: 20, fontWeight: 700,
              color: T.text, margin: '0 0 10px',
            }}>
              Energy Mode is a Pro Feature
            </h2>

            <p style={{
              fontFamily: T.mono, fontSize: 13, color: T.textDim,
              lineHeight: 1.7, margin: '0 0 24px',
            }}>
              Energy Mode is a Pro feature. Resize tasks to 3-minute first steps on hard days.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => navigate('/billing')}
                style={{
                  background: T.indigo,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontFamily: T.mono,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '12px 0',
                  cursor: 'pointer',
                  minHeight: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Lock size={14} />
                Upgrade to Pro — $9/mo
              </button>

              <button
                onClick={onDismiss}
                style={{
                  background: 'transparent',
                  color: T.muted,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  fontFamily: T.mono,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '10px 0',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Maybe later
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Normal energy mode content */}
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
          </>
        )}
      </div>
    </div>
  )
}
