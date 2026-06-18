import type { RewardDrop } from '../lib/types'

interface RewardModalProps {
  drop: RewardDrop
  onEquip: (rewardId: string) => void
  onClose: () => void
  rewardId: string | null
}

const TYPE_ICON: Record<string, string> = { theme: '🎨', title: '👑', lore: '📖' }
const TYPE_LABEL: Record<string, string> = { theme: 'App Theme', title: 'Title', lore: 'Lore Fragment' }

export default function RewardModal({ drop, onEquip, onClose, rewardId }: RewardModalProps) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label="Jackpot reward"
      className="gf-jkp-scrim"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="gf-jkp">
        <div className="gf-jkp-label">✦ JACKPOT ✦</div>
        <div className="gf-jkp-pts">+{drop.points_awarded}</div>
        <div className="gf-jkp-sub">star points</div>
        <div className="gf-jkp-divider" />

        {drop.collectible_type && (
          <>
            <div className="gf-jkp-rare-cap">RARE DROP</div>
            <div className="gf-jkp-drop">
              <span className="gf-jkp-drop-ic">{TYPE_ICON[drop.collectible_type] ?? '✦'}</span>
              <div>
                <div className="gf-jkp-drop-name">{drop.collectible_display_name}</div>
                <div className="gf-jkp-drop-meta">
                  {TYPE_LABEL[drop.collectible_type] ?? drop.collectible_type} · Unlocked
                </div>
              </div>
            </div>
          </>
        )}

        <div className="gf-jkp-foot">
          {drop.collectible_type && drop.collectible_type !== 'lore' && rewardId && (
            <button onClick={() => { onEquip(rewardId); onClose() }} className="gf-jkp-equip">
              Equip
            </button>
          )}
          <button onClick={onClose} className="gf-jkp-close">Awesome!</button>
        </div>
      </div>
    </div>
  )
}
