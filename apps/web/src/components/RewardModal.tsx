import { useT } from '../lib/theme'
import type { RewardDrop } from '../lib/types'

interface RewardModalProps {
  drop: RewardDrop
  onEquip: (rewardId: string) => void
  onClose: () => void
  // rewardId from the rewards list (needed for equip call); null until rewards query updates
  rewardId: string | null
}

const TYPE_ICON: Record<string, string> = {
  theme: '🎨',
  title: '👑',
  lore: '📖',
}

const TYPE_LABEL: Record<string, string> = {
  theme: 'App Theme',
  title: 'Title',
  lore: 'Lore Fragment',
}

export default function RewardModal({ drop, onEquip, onClose, rewardId }: RewardModalProps) {
  const T = useT()
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jackpot reward"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        animation: 'fadeInBg 0.2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: T.card2,
        border: `1px solid ${T.indigo}44`,
        borderRadius: 16,
        padding: '28px 32px',
        textAlign: 'center',
        maxWidth: 320,
        width: '90%',
        boxShadow: `0 0 60px ${T.indigo}22`,
        animation: 'modalPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Tier label */}
        <div style={{
          fontFamily: T.mono, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.12em', color: T.amber, marginBottom: 10,
        }}>
          ✦ JACKPOT ✦
        </div>

        {/* Points */}
        <div style={{ fontFamily: T.mono, fontSize: 36, fontWeight: 700, color: T.amber, lineHeight: 1 }}>
          +{drop.points_awarded}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginBottom: 20 }}>
          star points
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.border, marginBottom: 16 }} />

        {/* Collectible card */}
        {drop.collectible_type && (
          <>
            <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color: T.muted, marginBottom: 10 }}>
              RARE DROP
            </div>
            <div style={{
              background: `${T.indigo}15`, border: `1px solid ${T.indigo}40`,
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 20, textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>{TYPE_ICON[drop.collectible_type] ?? '✦'}</span>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.text }}>
                  {drop.collectible_display_name}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>
                  {TYPE_LABEL[drop.collectible_type] ?? drop.collectible_type} · Unlocked
                </div>
              </div>
            </div>
          </>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10 }}>
          {drop.collectible_type && drop.collectible_type !== 'lore' && rewardId && (
            <button
              onClick={() => { onEquip(rewardId); onClose() }}
              style={{
                flex: 1,
                background: T.orange, color: '#0a0a14',
                border: 'none', borderRadius: 8,
                fontFamily: T.mono, fontSize: 12, fontWeight: 700,
                padding: '10px 0', cursor: 'pointer',
                minHeight: 44,
              }}
            >
              Equip
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: T.surface, color: T.textDim,
              border: `1px solid ${T.border}`, borderRadius: 8,
              fontFamily: T.mono, fontSize: 12, fontWeight: 700,
              padding: '10px 0', cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Awesome!
          </button>
        </div>
      </div>
    </div>
  )
}
