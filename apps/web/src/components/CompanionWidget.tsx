import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creature } from './GamificationSvgs'
import { STAGES, getStage, getNext, stagePct } from '../lib/gamification'

interface CompanionWidgetProps {
  pts: number
}

export default function CompanionWidget({ pts }: CompanionWidgetProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const stage = getStage(pts)
  const next = getNext(pts)
  const pct = stagePct(pts)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Your companion: ${stage.name}. ${pts} star points.`}
        className="companion-fab"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 90,
          border: `2px solid color-mix(in oklab, ${stage.color} 50%, transparent)`,
          background: `color-mix(in oklab, ${stage.color} 12%, transparent)`,
          borderRadius: '50%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
          boxShadow: `0 4px 24px color-mix(in oklab, ${stage.color} 18%, transparent)`,
          padding: 0,
        }}
      >
        <div style={{ marginTop: -2 }}>
          <Creature pts={pts} size={36} />
        </div>
      </button>

      <div
        className="companion-fab-bar"
        style={{
          position: 'fixed', bottom: 8, right: 20, zIndex: 90,
          borderRadius: 2, overflow: 'hidden',
          background: 'var(--text-mute)', pointerEvents: 'none',
        }}
      >
        <div style={{ height: '100%', borderRadius: 2, background: stage.color, width: `${pct * 100}%` }} />
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          role="dialog" aria-modal="true" aria-label="Your companion"
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              border: `1px solid color-mix(in oklab, ${stage.color} 40%, transparent)`,
              borderRadius: 16, padding: '28px 24px', width: '100%',
              maxWidth: 300, textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Creature pts={pts} size={120} />
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: stage.color, marginBottom: 4 }}>
              {stage.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', fontStyle: 'italic', marginBottom: 18, lineHeight: 1.5 }}>
              &quot;{stage.desc}&quot;
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 14, flexWrap: 'wrap' }}>
              {STAGES.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div
                    title={`${s.name} — ${s.pts} pts`}
                    style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: pts >= s.pts ? `color-mix(in oklab, ${s.color} 30%, transparent)` : 'var(--card-hi)',
                      border: `2px solid ${pts >= s.pts ? s.color : 'var(--text-mute)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: pts >= s.pts ? s.color : 'var(--text-mute)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {pts >= s.pts ? '✦' : '·'}
                  </div>
                  {i < STAGES.length - 1 && (
                    <div style={{ width: 8, height: 2, borderRadius: 1, background: pts > s.pts ? s.color : 'var(--text-mute)' }} />
                  )}
                </div>
              ))}
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)', marginBottom: 16 }}>
              {next ? `${next.pts - pts} pts to ${next.name}` : '✦ Maximum evolution reached'}
            </div>

            <button
              onClick={() => { setOpen(false); navigate('/stars') }}
              className="gf-btn-ghost-accent"
              style={{
                '--accent': 'var(--gold)',
                '--accent-soft': 'color-mix(in oklab, var(--gold) 18%, transparent)',
                '--accent-line': 'color-mix(in oklab, var(--gold) 45%, transparent)',
                '--accent-ink': 'var(--gold)',
              } as React.CSSProperties}
            >
              Go to Star Hub →
            </button>
          </div>
        </div>
      )}

      <style>{`
        .companion-fab { width: 56px; height: 56px; }
        .companion-fab-bar { width: 48px; height: 3px; }
        @media (max-width: 639px) {
          .companion-fab { width: 48px; height: 48px; }
          .companion-fab-bar { width: 40px; height: 3px; }
        }
      `}</style>
    </>
  )
}
