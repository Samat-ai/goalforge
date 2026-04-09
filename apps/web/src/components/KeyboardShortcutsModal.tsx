import { useEffect } from 'react'
import { T } from '../lib/theme'
import type { Shortcut } from '../hooks/useKeyboardShortcuts'

interface KeyboardShortcutsModalProps {
  shortcuts: Shortcut[]
  onClose: () => void
}

interface ShortcutGroup {
  label: string
  shortcuts: Shortcut[]
}

function buildGroups(shortcuts: Shortcut[]): ShortcutGroup[] {
  const nav: Shortcut[] = []
  const goals: Shortcut[] = []
  const general: Shortcut[] = []

  for (const s of shortcuts) {
    if (s.description.startsWith('[nav]')) {
      nav.push({ ...s, description: s.description.replace('[nav]', '').trim() })
    } else if (s.description.startsWith('[goals]')) {
      goals.push({ ...s, description: s.description.replace('[goals]', '').trim() })
    } else {
      general.push(s)
    }
  }

  const groups: ShortcutGroup[] = []
  if (nav.length) groups.push({ label: 'Navigation', shortcuts: nav })
  if (goals.length) groups.push({ label: 'Goals', shortcuts: goals })
  if (general.length) groups.push({ label: 'General', shortcuts: general })
  return groups
}

function formatKey(s: Shortcut): string[] {
  const parts: string[] = []
  if (s.ctrl) parts.push('Ctrl')
  if (s.alt) parts.push('Alt')
  if (s.shift) parts.push('Shift')
  parts.push(s.key === '/' ? '/' : s.key === '?' ? '?' : s.key === 'Escape' ? 'Esc' : s.key.toUpperCase())
  return parts
}

export default function KeyboardShortcutsModal({ shortcuts, onClose }: KeyboardShortcutsModalProps) {
  const groups = buildGroups(shortcuts)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(7,7,15,0.82)', backdropFilter: 'blur(4px)',
        animation: 'fadeUp 0.18s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, border: `1px solid ${T.borderHi}`,
          borderRadius: 16, width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          margin: '0 16px',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: '0.04em' }}>
            Keyboard Shortcuts
          </span>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            style={{
              background: 'none', border: 'none', color: T.muted,
              fontSize: 20, cursor: 'pointer', minWidth: 44, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 24px' }}>
          {groups.map(group => (
            <div key={group.label} style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: T.mono, fontSize: 10, fontWeight: 600,
                color: T.orange, letterSpacing: '0.1em', marginBottom: 12,
                textTransform: 'uppercase',
              }}>
                {group.label}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {group.shortcuts.map((s, i) => {
                  const keys = formatKey(s)
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 8,
                        background: T.surface, border: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>
                        {s.description}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {keys.map((k, ki) => (
                          <kbd
                            key={ki}
                            style={{
                              fontFamily: T.mono, fontSize: 11,
                              background: '#1c1c30', color: T.text,
                              border: `1px solid ${T.borderHi}`,
                              borderRadius: 5, padding: '2px 7px',
                              boxShadow: '0 2px 0 #0005',
                              display: 'inline-block', lineHeight: '18px',
                            }}
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          borderTop: `1px solid ${T.border}`,
          padding: '10px 20px',
          fontFamily: T.mono, fontSize: 11, color: T.muted,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <kbd style={{
            fontFamily: T.mono, fontSize: 10,
            background: '#1c1c30', color: T.textDim,
            border: `1px solid ${T.borderHi}`,
            borderRadius: 4, padding: '1px 5px',
            boxShadow: '0 1px 0 #0005',
          }}>Esc</kbd>
          <span>to close</span>
        </div>
      </div>
    </div>
  )
}
