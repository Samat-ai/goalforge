import { useState } from 'react'
import { useT } from '../lib/theme'
import type { Reward } from '../lib/types'

// Static registry sizes (mirrors backend COLLECTIBLE_REGISTRY)
const REGISTRY_COUNTS = { theme: 4, title: 12, lore: 6 }

interface CollectionModalProps {
  rewards: Reward[]
  onEquip: (rewardId: string) => void
  onClose: () => void
}

type Section = 'themes' | 'titles' | 'lore'

export default function CollectionModal({ rewards, onEquip, onClose }: CollectionModalProps) {
  const T = useT()
  const [activeSection, setActiveSection] = useState<Section>('themes')
  const [expandedLore, setExpandedLore] = useState<string | null>(null)

  const themes = rewards.filter(r => r.reward_type === 'theme')
  const titles = rewards.filter(r => r.reward_type === 'title')
  const loreFragments = rewards.filter(r => r.reward_type === 'lore')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trophy Room"
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        display: 'flex', flexDirection: 'column',
        background: T.bg,
        animation: 'fadeInBg 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.text }}>
          🏆 Trophy Room
        </span>
        <button
          onClick={onClose}
          aria-label="Close Trophy Room"
          style={{
            background: 'none', border: 'none', color: T.muted,
            fontSize: 20, cursor: 'pointer', minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
        {(['themes', 'titles', 'lore'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            style={{
              background: 'none', border: 'none',
              padding: '10px 18px', cursor: 'pointer',
              fontFamily: T.mono, fontSize: 12,
              color: activeSection === s ? T.text : T.muted,
              borderBottom: activeSection === s ? `2px solid ${T.orange}` : '2px solid transparent',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* Themes */}
        {activeSection === 'themes' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {themes.map(r => (
              <div key={r.id} style={{
                background: T.card,
                border: `1px solid ${r.is_equipped ? T.orange : T.border}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '0.08em', color: T.muted, marginBottom: 4 }}>THEME</div>
                <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>{r.display_name}</div>
                {r.is_equipped ? (
                  <span style={{ fontFamily: T.mono, fontSize: 9, background: `${T.orange}20`, color: T.orange, padding: '2px 6px', borderRadius: 3 }}>equipped</span>
                ) : (
                  <button
                    onClick={() => onEquip(r.id)}
                    style={{
                      background: T.orange, color: '#0a0a14',
                      border: 'none', borderRadius: 5,
                      fontFamily: T.mono, fontSize: 10, fontWeight: 700,
                      padding: '4px 10px', cursor: 'pointer', minHeight: 44,
                    }}
                  >
                    Equip
                  </button>
                )}
              </div>
            ))}
            {/* Locked slots */}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.theme - themes.length) }).map((_, i) => (
              <div key={`locked-theme-${i}`} style={{
                background: T.surface, border: `1px dashed ${T.border}`,
                borderRadius: 10, padding: '12px 14px', opacity: 0.4,
              }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginBottom: 4 }}>THEME</div>
                <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim }}>???</div>
              </div>
            ))}
          </div>
        )}

        {/* Titles */}
        {activeSection === 'titles' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {titles.map(r => (
              <div key={r.id} style={{
                background: T.card,
                border: `1px solid ${r.is_equipped ? T.orange : T.border}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '0.08em', color: T.muted, marginBottom: 4 }}>TITLE</div>
                <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>{r.display_name}</div>
                {r.is_equipped ? (
                  <span style={{ fontFamily: T.mono, fontSize: 9, background: `${T.orange}20`, color: T.orange, padding: '2px 6px', borderRadius: 3 }}>equipped</span>
                ) : (
                  <button
                    onClick={() => onEquip(r.id)}
                    style={{
                      background: T.orange, color: '#0a0a14',
                      border: 'none', borderRadius: 5,
                      fontFamily: T.mono, fontSize: 10, fontWeight: 700,
                      padding: '4px 10px', cursor: 'pointer', minHeight: 44,
                    }}
                  >
                    Equip
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.title - titles.length) }).map((_, i) => (
              <div key={`locked-title-${i}`} style={{
                background: T.surface, border: `1px dashed ${T.border}`,
                borderRadius: 10, padding: '12px 14px', opacity: 0.4,
              }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginBottom: 4 }}>TITLE</div>
                <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim }}>???</div>
              </div>
            ))}
          </div>
        )}

        {/* Lore Fragments */}
        {activeSection === 'lore' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loreFragments.map(r => (
              <div key={r.id} style={{
                background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '0.08em', color: T.muted, marginBottom: 4 }}>LORE FRAGMENT</div>
                    <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.indigo }}>{r.display_name}</div>
                  </div>
                  <button
                    onClick={() => setExpandedLore(expandedLore === r.id ? null : r.id)}
                    style={{
                      background: `${T.indigo}20`, border: `1px solid ${T.indigo}40`,
                      color: T.indigo, borderRadius: 5,
                      fontFamily: T.mono, fontSize: 10, fontWeight: 700,
                      padding: '4px 10px', cursor: 'pointer', minHeight: 44,
                    }}
                  >
                    {expandedLore === r.id ? 'Close' : 'Read'}
                  </button>
                </div>
                {expandedLore === r.id && r.body && (
                  <div style={{
                    marginTop: 12, fontFamily: T.serif, fontSize: 13,
                    color: T.textDim, lineHeight: 1.7,
                    borderTop: `1px solid ${T.border}`, paddingTop: 12,
                  }}>
                    {r.body}
                  </div>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, REGISTRY_COUNTS.lore - loreFragments.length) }).map((_, i) => (
              <div key={`locked-lore-${i}`} style={{
                background: T.surface, border: `1px dashed ${T.border}`,
                borderRadius: 10, padding: '14px 16px', opacity: 0.4,
              }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginBottom: 4 }}>LORE FRAGMENT</div>
                <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim }}>??? Locked</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
