// Authored preview — CollectionModal (Trophy Room full-screen dialog; cardMode
// "single" + viewport in config overrides). Frame contains the fixed dialog and
// pins its entrance animation to final state (headless clock never ticks).
import { CollectionModal } from 'web'
import type { ReactNode } from 'react'

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ transform: 'translateZ(0)', height: 560, width: '100%', overflow: 'hidden', borderRadius: 14 }}>
    <style>{'.gf-coll{animation:none!important}'}</style>
    {children}
  </div>
)

const REWARDS = [
  { id: 'rw_1', reward_type: 'theme' as const, reward_key: 'aurora', display_name: 'Aurora Veil', body: null, is_equipped: true, acquired_at: '2026-07-01T10:00:00Z' },
  { id: 'rw_2', reward_type: 'theme' as const, reward_key: 'ember', display_name: 'Ember Drift', body: null, is_equipped: false, acquired_at: '2026-07-08T10:00:00Z' },
  { id: 'rw_3', reward_type: 'title' as const, reward_key: 'starsmith', display_name: 'Starsmith', body: null, is_equipped: false, acquired_at: '2026-07-10T10:00:00Z' },
  { id: 'rw_4', reward_type: 'lore' as const, reward_key: 'origin_1', display_name: 'The First Spark', body: 'Before there were goals, there was only the dark between stars — and one stubborn spark that refused to fade.', is_equipped: false, acquired_at: '2026-07-12T10:00:00Z' },
]

export function TrophyRoom() {
  return (
    <Frame>
      <CollectionModal rewards={REWARDS} onEquip={() => {}} onClose={() => {}} />
    </Frame>
  )
}
