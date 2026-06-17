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
        background: 'linear-gradient(160deg, #1a0f2e 0%, #0f0f1a 100%)',
        border: `1px solid #a78bfa44`,
        borderRadius: 16,
        padding: '28px 32px',
        textAlign: 'center',
        maxWidth: 320,
        width: '90%',
        boxShadow: '0 0 60px #a78bfa22',
        animation: 'modalPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Tier label */}
        <div style={{
          fontFamily: T.mono, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.12em', color: '#f59e0b', marginBottom: 10,
        }}>
          ✦ JACKPOT ✦
        </div>

        {/* Points */}
        <div style={{ fontFamily: T.mono, fontSize: 36, fontWeight: 700, color: '#fbbf24', lineHeight: 1 }}>
          +{drop.points_awarded}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: '#6b7280', marginBottom: 20 }}>
          star points
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#2a2a3a', marginBottom: 16 }} />

        {/* Collectible card */}
        {drop.collectible_type && (
          <>
            <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color: '#6b7280', marginBottom: 10 }}>
              RARE DROP
            </div>
            <div style={{
              background: '#a78bfa15', border: '1px solid #a78bfa40',
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 20, textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>{TYPE_ICON[drop.collectible_type] ?? '✦'}</span>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                  {drop.collectible_display_name}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: '#6b7280' }}>
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
              background: '#1e1e2e', color: '#9ca3af',
              border: '1px solid #2a2a3a', borderRadius: 8,
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
