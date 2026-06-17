import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creature } from './GamificationSvgs'
import { STAGES, getStage, getNext, stagePct } from '../lib/gamification'
import { useT } from '../lib/theme'

interface CompanionWidgetProps {
  pts: number
}

export default function CompanionWidget({ pts }: CompanionWidgetProps) {
  const T = useT()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const stage = getStage(pts)
  const next = getNext(pts)
  const pct = stagePct(pts)

  // Close modal on Escape — attached to window so it works regardless of focus
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label={`Your companion: ${stage.name}. ${pts} star points.`}
        className="companion-fab"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 90,
          border: `2px solid ${stage.color}50`,
          background: `${stage.color}12`,
          borderRadius: '50%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
          boxShadow: `0 4px 24px ${stage.color}18`,
          padding: 0,
        }}
      >
        <div style={{ marginTop: -2 }}>
          <Creature pts={pts} size={36} />
        </div>
      </button>

      {/* Progress bar under FAB */}
      <div
        className="companion-fab-bar"
        style={{
          position: 'fixed', bottom: 8, right: 20, zIndex: 90,
          borderRadius: 2, overflow: 'hidden',
          background: T.dim, pointerEvents: 'none',
        }}
      >
        <div style={{
          height: '100%', borderRadius: 2,
          background: stage.color, width: `${pct * 100}%`,
        }} />
      </div>

      {/* Modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Your companion"

        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card, border: `1px solid ${stage.color}40`,
              borderRadius: 16, padding: '28px 24px', width: '100%',
              maxWidth: 300, textAlign: 'center',
            }}
          >
            {/* Creature */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Creature pts={pts} size={120} />
            </div>

            {/* Stage name */}
            <div style={{ fontFamily: T.serif, fontSize: 22, color: stage.color, marginBottom: 4 }}>
              {stage.name}
            </div>
            <div style={{
              fontFamily: T.mono, fontSize: 11, color: T.muted,
              fontStyle: 'italic', marginBottom: 18, lineHeight: 1.5,
            }}>
              "{stage.desc}"
            </div>

            {/* Evolution track */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 3, marginBottom: 14, flexWrap: 'wrap',
            }}>
              {STAGES.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div
                    title={`${s.name} — ${s.pts} pts`}
                    style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: pts >= s.pts ? `${s.color}30` : T.surface,
                      border: `2px solid ${pts >= s.pts ? s.color : T.dim}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: pts >= s.pts ? s.color : T.dim,
                      fontFamily: T.mono,
                    }}
                  >
                    {pts >= s.pts ? '✦' : '·'}
                  </div>
                  {i < STAGES.length - 1 && (
                    <div style={{
                      width: 8, height: 2, borderRadius: 1,
                      background: pts > s.pts ? s.color : T.dim,
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* Points to next */}
            <div style={{
              fontFamily: T.mono, fontSize: 10, color: T.dim, marginBottom: 16,
            }}>
              {next ? `${next.pts - pts} pts to ${next.name}` : '✦ Maximum evolution reached'}
            </div>

            {/* CTA */}
            <button
              onClick={() => { setOpen(false); navigate('/stars') }}
              style={{
                minHeight: 44, minWidth: 44, padding: '9px 22px',
                borderRadius: 8, cursor: 'pointer',
                fontFamily: T.mono, fontSize: 11, letterSpacing: '0.05em',
                background: `${T.amber}18`, color: T.amber,
                border: `1px solid ${T.amber}45`,
              }}
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
