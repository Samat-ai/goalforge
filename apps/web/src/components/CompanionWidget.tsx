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
        <div className="gf-cw-fab-inner">
          <Creature pts={pts} size={36} />
        </div>
      </button>

      <div className="gf-cw-bar-track" style={{ width: 48, height: 3 }}>
        <div style={{ height: '100%', borderRadius: 2, background: stage.color, width: `${pct * 100}%` }} />
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="gf-overlay"
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
            <div className="gf-cw-creature">
              <Creature pts={pts} size={120} />
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: stage.color, marginBottom: 4 }}>
              {stage.name}
            </div>
            <div className="gf-cw-desc">
              &quot;{stage.desc}&quot;
            </div>

            <div className="gf-cw-stages">
              {STAGES.map((s, i) => (
                <div key={s.id} className="gf-cw-stage-item">
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

            <div className="gf-cw-next">
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
        @media (max-width: 639px) {
          .companion-fab { width: 48px; height: 48px; }
        }
      `}</style>
    </>
  )
}
