import { useState } from 'react'
import type { Reward } from '../lib/types'

const REGISTRY_COUNTS = { theme: 4, title: 12, lore: 6 }

interface CollectionModalProps {
  rewards: Reward[]
  onEquip: (rewardId: string) => void
  onClose: () => void
}

type Section = 'themes' | 'titles' | 'lore'

const CARD_BASE: React.CSSProperties = { background: 'var(--card)', borderRadius: 10, padding: '12px 14px' }
const LOCKED_BASE: React.CSSProperties = { background: 'var(--card-hi)', border: '1px dashed var(--border)', borderRadius: 10, padding: '12px 14px', opacity: 0.4 }

function EquipBtn({ onEquip, id }: { onEquip: (id: string) => void; id: string }) {
  return (
    <button
      onClick={() => onEquip(id)}
      style={{
        background: 'var(--accent)', color: '#0a0a14', border: 'none', borderRadius: 5,
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        padding: '4px 10px', cursor: 'pointer', minHeight: 44,
      }}
    >
      Equip
    </button>
  )
}

function EquippedBadge() {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9,
      background: 'color-mix(in oklab, var(--accent) 20%, transparent)',
      color: 'var(--accent)', padding: '2px 6px', borderRadius: 3,
    }}>
      equipped
    </span>
  )
}

export default function CollectionModal({ rewards, onEquip, onClose }: CollectionModalProps) {
  const [activeSection, setActiveSection] = useState<Section>('themes')
  const [expandedLore, setExpandedLore] = useState<string | null>(null)

  const themes = rewards.filter(r => r.reward_type === 'theme')
  const titles = rewards.filter(r => r.reward_type === 'title')
  const loreFragments = rewards.filter(r => r.reward_type === 'lore')

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Trophy Room"
      style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', flexDirection: 'column', background: 'var(--bg)', animation: 'fadeInBg 0.2s ease' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          🏆 Trophy Room
        </span>
        <button
          onClick={onClose}
          aria-label="Close Trophy Room"
          style={{ background: 'none', border: 'none', color: 'var(--text-mute)', fontSize: 20, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['themes', 'titles', 'lore'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            style={{
              background: 'none', border: 'none', padding: '10px 18px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: activeSection === s ? 'var(--text)' : 'var(--text-mute)',
              borderBottom: activeSection === s ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {activeSection === 'themes' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {themes.map(r => (
              <div key={r.id} style={{ ...CARD_BASE, border: `1px solid ${r.is_equipped ? 'var(--accent)' : 'var(--border)'}` }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-mute)', marginBottom: 4 }}>THEME</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{r.display_name}</div>
                {r.is_equipped ? <EquippedBadge /> : <EquipBtn onEquip={onEquip} id={r.id} />}
              </div>
            ))}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.theme - themes.length) }).map((_, i) => (
              <div key={`locked-theme-${i}`} style={LOCKED_BASE}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-mute)', marginBottom: 4 }}>THEME</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mute)' }}>???</div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'titles' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {titles.map(r => (
              <div key={r.id} style={{ ...CARD_BASE, border: `1px solid ${r.is_equipped ? 'var(--accent)' : 'var(--border)'}` }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-mute)', marginBottom: 4 }}>TITLE</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{r.display_name}</div>
                {r.is_equipped ? <EquippedBadge /> : <EquipBtn onEquip={onEquip} id={r.id} />}
              </div>
            ))}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.title - titles.length) }).map((_, i) => (
              <div key={`locked-title-${i}`} style={LOCKED_BASE}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-mute)', marginBottom: 4 }}>TITLE</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mute)' }}>???</div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'lore' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loreFragments.map(r => (
              <div key={r.id} style={{ ...CARD_BASE, border: '1px solid var(--border)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-mute)', marginBottom: 4 }}>LORE FRAGMENT</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--indigo)' }}>{r.display_name}</div>
                  </div>
                  <button
                    onClick={() => setExpandedLore(expandedLore === r.id ? null : r.id)}
                    style={{
                      background: 'color-mix(in oklab, var(--indigo) 20%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--indigo) 40%, transparent)',
                      color: 'var(--indigo)', borderRadius: 5,
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                      padding: '4px 10px', cursor: 'pointer', minHeight: 44,
                    }}
                  >
                    {expandedLore === r.id ? 'Close' : 'Read'}
                  </button>
                </div>
                {expandedLore === r.id && r.body && (
                  <div style={{ marginTop: 12, fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    {r.body}
                  </div>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.lore - loreFragments.length) }).map((_, i) => (
              <div key={`locked-lore-${i}`} style={{ ...LOCKED_BASE, padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-mute)', marginBottom: 4 }}>LORE FRAGMENT</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mute)' }}>??? Locked</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
