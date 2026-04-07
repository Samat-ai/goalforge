import { useNavigate } from 'react-router-dom'
import { Lock, Target, Brain, Zap, BarChart2, Users, Download, X } from 'lucide-react'
import { T } from '../lib/theme'
import type { UpgradeFeature } from '../hooks/useUpgradePrompt'

// ── Feature metadata ──────────────────────────────────────────────────────────

const FEATURE_CONFIG: Record<UpgradeFeature, {
  icon: React.ReactNode
  headline: string
  description: string
}> = {
  goals: {
    icon: <Target size={32} color={T.indigo} />,
    headline: "You've Reached Your Goal Limit",
    description: "You've reached your 2 goal limit. Upgrade to Pro for unlimited goals.",
  },
  coaching: {
    icon: <Brain size={32} color={T.indigo} />,
    headline: 'AI Coaching is a Pro Feature',
    description: 'AI Coaching is a Pro feature. Get personalized goal planning with our 5-question intake.',
  },
  energy: {
    icon: <Zap size={32} color={T.indigo} />,
    headline: 'Energy Mode is a Pro Feature',
    description: 'Energy Mode is a Pro feature. Resize tasks to 3-minute first steps on hard days.',
  },
  analytics: {
    icon: <BarChart2 size={32} color={T.indigo} />,
    headline: 'Full Analytics is a Pro Feature',
    description: 'Full analytics history is a Pro feature. See your complete progress over time.',
  },
  accountability: {
    icon: <Users size={32} color={T.indigo} />,
    headline: 'Accountability Partners is a Pro Feature',
    description: 'Accountability partners are a Pro feature. Invite someone to keep you on track.',
  },
  export: {
    icon: <Download size={32} color={T.indigo} />,
    headline: 'Data Export is a Pro Feature',
    description: 'Data export is a Pro feature. Download all your goals and progress as CSV.',
  },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface UpgradePromptProps {
  variant: 'modal' | 'banner' | 'inline'
  feature: UpgradeFeature
  onClose?: () => void
}

// ── Modal variant ─────────────────────────────────────────────────────────────

function ModalVariant({ feature, onClose }: { feature: UpgradeFeature; onClose?: () => void }) {
  const navigate = useNavigate()
  const { icon, headline, description } = FEATURE_CONFIG[feature]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to Pro"
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.80)',
        animation: 'fadeInBg 0.2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div style={{
        background: `linear-gradient(160deg, ${T.card} 0%, #0d0d1e 100%)`,
        border: `1px solid ${T.indigo}44`,
        borderRadius: 16,
        padding: '32px 28px',
        textAlign: 'center',
        maxWidth: 360,
        width: '90%',
        boxShadow: `0 0 60px ${T.indigo}22`,
        animation: 'modalPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
      }}>
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Dismiss upgrade prompt"
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'transparent', border: 'none',
              cursor: 'pointer', color: T.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 32, minWidth: 32, borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* Icon */}
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: `${T.indigo}18`, border: `1px solid ${T.indigo}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
        </div>

        {/* Headline */}
        <h2 style={{
          fontFamily: T.serif, fontSize: 20, fontWeight: 700,
          color: T.text, margin: '0 0 10px', lineHeight: 1.3,
        }}>
          {headline}
        </h2>

        {/* Description */}
        <p style={{
          fontFamily: T.mono, fontSize: 13, color: T.textDim,
          lineHeight: 1.7, margin: '0 0 24px',
        }}>
          {description}
        </p>

        {/* CTAs */}
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
              transition: 'opacity 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Lock size={14} />
            Upgrade to Pro — $9/mo
          </button>

          <button
            onClick={onClose}
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

        <style>{`
          @keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalPop { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        `}</style>
      </div>
    </div>
  )
}

// ── Banner variant ────────────────────────────────────────────────────────────

function BannerVariant({ feature, onClose }: { feature: UpgradeFeature; onClose?: () => void }) {
  const navigate = useNavigate()
  const { description } = FEATURE_CONFIG[feature]

  return (
    <div style={{
      position: 'sticky', top: 54, zIndex: 99,
      background: 'linear-gradient(90deg, #92400e, #d97706)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <Lock size={14} color="#fff" style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: T.mono, fontSize: 12, color: '#fff', flex: 1, minWidth: 0 }}>
        {description}
      </span>
      <button
        onClick={() => navigate('/billing')}
        style={{
          background: '#fff',
          color: '#92400e',
          border: 'none',
          borderRadius: 6,
          fontFamily: T.mono,
          fontSize: 11,
          fontWeight: 700,
          padding: '6px 14px',
          cursor: 'pointer',
          minHeight: 32,
          flexShrink: 0,
          letterSpacing: '0.04em',
        }}
      >
        Upgrade →
      </button>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss banner"
          style={{
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'rgba(255,255,255,0.8)',
            display: 'flex', alignItems: 'center', minHeight: 32, minWidth: 32,
            padding: '0 4px',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ── Inline variant ────────────────────────────────────────────────────────────

function InlineVariant({ feature, onClose }: { feature: UpgradeFeature; onClose?: () => void }) {
  const navigate = useNavigate()
  const { icon, headline, description } = FEATURE_CONFIG[feature]

  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${T.indigo}40`,
      background: `${T.card}`,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Blurred content placeholder */}
      <div style={{
        padding: '16px 18px',
        filter: 'blur(3px)',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0.4,
      }}>
        <div style={{ height: 12, background: T.dim, borderRadius: 4, marginBottom: 8, width: '70%' }} />
        <div style={{ height: 10, background: T.dim, borderRadius: 4, marginBottom: 6, width: '50%' }} />
        <div style={{ height: 10, background: T.dim, borderRadius: 4, width: '60%' }} />
      </div>

      {/* Upgrade overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: `${T.bg}cc`,
        padding: '20px 16px',
        textAlign: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: `${T.indigo}18`, border: `1px solid ${T.indigo}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 4,
        }}>
          {icon}
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600, color: T.text }}>
          {headline}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, lineHeight: 1.6, maxWidth: 280 }}>
          {description}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button
            onClick={() => navigate('/billing')}
            style={{
              background: T.indigo,
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              fontFamily: T.mono,
              fontSize: 11,
              fontWeight: 700,
              padding: '9px 18px',
              cursor: 'pointer',
              minHeight: 36,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Lock size={12} />
            Upgrade to Pro — $9/mo
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                color: T.muted,
                border: `1px solid ${T.border}`,
                borderRadius: 7,
                fontFamily: T.mono,
                fontSize: 11,
                padding: '9px 14px',
                cursor: 'pointer',
                minHeight: 36,
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function UpgradePrompt({ variant, feature, onClose }: UpgradePromptProps) {
  if (variant === 'modal') return <ModalVariant feature={feature} onClose={onClose} />
  if (variant === 'banner') return <BannerVariant feature={feature} onClose={onClose} />
  return <InlineVariant feature={feature} onClose={onClose} />
}
