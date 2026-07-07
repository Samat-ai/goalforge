import { useEffect, useState } from 'react'
import { REGISTRY_COUNTS } from '../lib/collectibles'
import type { Reward } from '../lib/types'

interface CollectionModalProps {
  rewards: Reward[]
  onEquip: (rewardId: string) => void
  onClose: () => void
}

type Section = 'themes' | 'titles' | 'lore'

function EquipBtn({ onEquip, id }: { onEquip: (id: string) => void; id: string }) {
  return <button onClick={() => onEquip(id)} className="gf-coll-equip">Equip</button>
}

function EquippedBadge() {
  return <span className="gf-coll-equipped">equipped</span>
}

export default function CollectionModal({ rewards, onEquip, onClose }: CollectionModalProps) {
  const [activeSection, setActiveSection] = useState<Section>('themes')
  const [expandedLore, setExpandedLore] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const themes = rewards.filter(r => r.reward_type === 'theme')
  const titles = rewards.filter(r => r.reward_type === 'title')
  const loreFragments = rewards.filter(r => r.reward_type === 'lore')

  return (
    <div role="dialog" aria-modal="true" aria-label="Trophy Room" className="gf-coll">
      <div className="gf-coll-head">
        <span className="gf-coll-title">🏆 Trophy Room</span>
        <button onClick={onClose} aria-label="Close Trophy Room" className="gf-coll-close">×</button>
      </div>

      <div className="gf-coll-tabbar">
        {(['themes', 'titles', 'lore'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`gf-coll-tab${activeSection === s ? ' is-on' : ''}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="gf-coll-body">
        {activeSection === 'themes' && (
          <div className="gf-coll-grid">
            {themes.map(r => (
              <div key={r.id} className={`gf-coll-card${r.is_equipped ? ' is-equipped' : ''}`}>
                <div className="gf-coll-cap">THEME</div>
                <div className="gf-coll-name">{r.display_name}</div>
                {r.is_equipped ? <EquippedBadge /> : <EquipBtn onEquip={onEquip} id={r.id} />}
              </div>
            ))}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.theme - themes.length) }).map((_, i) => (
              <div key={`locked-theme-${i}`} className="gf-coll-locked">
                <div className="gf-coll-cap">THEME</div>
                <div className="gf-coll-name-mute">???</div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'titles' && (
          <div className="gf-coll-grid">
            {titles.map(r => (
              <div key={r.id} className={`gf-coll-card${r.is_equipped ? ' is-equipped' : ''}`}>
                <div className="gf-coll-cap">TITLE</div>
                <div className="gf-coll-name">{r.display_name}</div>
                {r.is_equipped ? <EquippedBadge /> : <EquipBtn onEquip={onEquip} id={r.id} />}
              </div>
            ))}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.title - titles.length) }).map((_, i) => (
              <div key={`locked-title-${i}`} className="gf-coll-locked">
                <div className="gf-coll-cap">TITLE</div>
                <div className="gf-coll-name-mute">???</div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'lore' && (
          <div className="gf-coll-list">
            {loreFragments.map(r => (
              <div key={r.id} className="gf-coll-card is-lore">
                <div className="gf-coll-lore-row">
                  <div>
                    <div className="gf-coll-cap">LORE FRAGMENT</div>
                    <div className="gf-coll-lore-name">{r.display_name}</div>
                  </div>
                  <button
                    onClick={() => setExpandedLore(expandedLore === r.id ? null : r.id)}
                    className="gf-coll-read"
                  >
                    {expandedLore === r.id ? 'Close' : 'Read'}
                  </button>
                </div>
                {expandedLore === r.id && r.body && (
                  <div className="gf-coll-lore-body">{r.body}</div>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.lore - loreFragments.length) }).map((_, i) => (
              <div key={`locked-lore-${i}`} className="gf-coll-locked is-lore">
                <div className="gf-coll-cap">LORE FRAGMENT</div>
                <div className="gf-coll-name-mute">??? Locked</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
