// Authored preview — RewardModal (jackpot celebration dialog; cardMode "single"
// + viewport in config overrides). The Frame's transform makes it the containing
// block for the modal's fixed scrim, so each cell contains its own overlay.
import { RewardModal } from 'web'
import type { ReactNode } from 'react'

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ transform: 'translateZ(0)', height: 560, width: '100%', overflow: 'hidden', borderRadius: 14 }}>
    {/* headless capture never ticks the animation clock — pin entrance anims to their final state */}
    <style>{'.gf-jkp-scrim,.gf-jkp{animation:none!important}'}</style>
    {children}
  </div>
)

export function RareDrop() {
  return (
    <Frame>
    <RewardModal
      drop={{
        tier: 'jackpot',
        points_awarded: 50,
        collectible_type: 'theme',
        collectible_key: 'aurora',
        collectible_display_name: 'Aurora Veil',
        collectible_body: null,
      }}
      rewardId="rw_aurora"
      onEquip={() => {}}
      onClose={() => {}}
    />
    </Frame>
  )
}

export function PointsOnly() {
  return (
    <Frame>
    <RewardModal
      drop={{
        tier: 'jackpot',
        points_awarded: 50,
        collectible_type: null,
        collectible_key: null,
        collectible_display_name: null,
        collectible_body: null,
      }}
      rewardId={null}
      onEquip={() => {}}
      onClose={() => {}}
    />
    </Frame>
  )
}
