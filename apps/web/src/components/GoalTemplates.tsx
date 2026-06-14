import { useState } from 'react'
import { T } from '../lib/theme'
import { goalTemplates, categoryConfig, type GoalTemplate, type TemplateCategory } from '../lib/goalTemplates'

const CATEGORIES = Object.keys(categoryConfig) as TemplateCategory[]

const difficultyStyle: Record<GoalTemplate['difficulty'], { label: string; color: string }> = {
  beginner:     { label: 'Beginner',     color: '#4ade80' },
  intermediate: { label: 'Intermediate', color: '#fbbf24' },
  advanced:     { label: 'Advanced',     color: '#fb7185' },
}

interface GoalTemplatesProps {
  onSelect: (prompt: string) => void
}

export default function GoalTemplates({ onSelect }: GoalTemplatesProps) {
  const [open, setOpen]             = useState(false)
  const [activeCategory, setActive] = useState<TemplateCategory>('health')

  const templates = goalTemplates.filter(t => t.category === activeCategory)
  const catCfg    = categoryConfig[activeCategory]

  return (
    <div style={{ marginTop: 10 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer',
          background: 'transparent',
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          padding: '7px 14px',
          color: T.textDim,
          fontFamily: T.mono,
          fontSize: 12,
          letterSpacing: '0.04em',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = T.borderHi
          e.currentTarget.style.color = T.text
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = T.border
          e.currentTarget.style.color = T.textDim
        }}
      >
        <span style={{ fontSize: 14 }}>✦</span>
        {open ? 'Hide templates' : 'Browse templates'}
        <span style={{
          display: 'inline-block',
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          fontSize: 10,
        }}>▾</span>
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          marginTop: 10,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 11,
          overflow: 'hidden',
        }}>
          {/* Category tabs */}
          <div style={{
            display: 'flex',
            borderBottom: `1px solid ${T.border}`,
            overflowX: 'auto',
            gap: 0,
          }}>
            {CATEGORIES.map(cat => {
              const cfg      = categoryConfig[cat]
              const isActive = cat === activeCategory
              return (
                <button
                  key={cat}
                  onClick={() => setActive(cat)}
                  style={{
                    cursor: 'pointer',
                    flex: '1 1 0',
                    minWidth: 80,
                    padding: '10px 8px',
                    background: isActive ? `${cfg.color}15` : 'transparent',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${cfg.color}` : '2px solid transparent',
                    color: isActive ? cfg.color : T.textDim,
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: '0.03em',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'color 0.15s, background 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = cfg.color
                      e.currentTarget.style.background = `${cfg.color}08`
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = T.textDim
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              )
            })}
          </div>

          {/* Template cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
            padding: 12,
          }}>
            {templates.map(t => {
              const diff = difficultyStyle[t.difficulty]
              return (
                <div
                  key={t.id}
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 9,
                    padding: '12px 13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${catCfg.color}50`
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = T.border
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
                    <span style={{
                      fontFamily: T.mono,
                      fontSize: 12,
                      color: T.text,
                      lineHeight: 1.35,
                      fontWeight: 600,
                    }}>{t.title}</span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      color: catCfg.color,
                      background: `${catCfg.color}15`,
                      border: `1px solid ${catCfg.color}30`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      letterSpacing: '0.02em',
                    }}>⏱ {t.timeframe}</span>
                    <span style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      color: diff.color,
                      background: `${diff.color}15`,
                      border: `1px solid ${diff.color}30`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      letterSpacing: '0.02em',
                    }}>{diff.label}</span>
                  </div>

                  {/* Use this button */}
                  <button
                    onClick={() => {
                      onSelect(t.prompt)
                      setOpen(false)
                    }}
                    style={{
                      cursor: 'pointer',
                      marginTop: 2,
                      padding: '6px 0',
                      background: `${catCfg.color}18`,
                      border: `1px solid ${catCfg.color}40`,
                      borderRadius: 6,
                      color: catCfg.color,
                      fontFamily: T.mono,
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = `${catCfg.color}30`
                      e.currentTarget.style.borderColor = `${catCfg.color}70`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = `${catCfg.color}18`
                      e.currentTarget.style.borderColor = `${catCfg.color}40`
                    }}
                  >
                    Use this →
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
