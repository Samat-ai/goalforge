import { useState, useEffect } from 'react'

const EXAMPLES = [
  'run a 5k in 8 weeks',
  'ship my side project by end of month',
  'read 12 books this year',
  'learn Spanish in 6 months',
  'wake up at 6am every day',
  'lose 15 pounds by August',
  'write 500 words every morning',
]

const CATEGORY_CHIPS = [
  { emoji: '🏋️', label: 'Get fit',          prompt: 'Build a consistent workout habit and lose 10 pounds over the next 3 months' },
  { emoji: '📚', label: 'Learn something',   prompt: 'Learn Spanish from scratch and hold a basic conversation in 6 months' },
  { emoji: '💰', label: 'Financial goal',    prompt: 'Save $5,000 in an emergency fund over the next 6 months' },
  { emoji: '✍️', label: 'Creative project',  prompt: 'Write the first draft of a short novel in 90 days' },
  { emoji: '🧘', label: 'Wellness',          prompt: 'Meditate for at least 10 minutes every day for 30 days' },
]

interface AddGoalProps {
  onAdd: (rawInput: string) => Promise<void>
  value: string
  onChange: (v: string) => void
  defaultValue?: string
}

export default function AddGoal({ onAdd, value, onChange, defaultValue }: AddGoalProps) {
  const [loading, setLoading]     = useState(false)
  const [status,  setStatus]      = useState<'idle' | 'thinking' | 'done' | 'error'>('idle')
  const [focused, setFocused]     = useState(false)
  const [typedText, setTypedText] = useState('')
  const [exampleIdx, setExampleIdx] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (defaultValue && !value) onChange(defaultValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Typewriter placeholder
  useEffect(() => {
    if (focused || value) return
    const current = EXAMPLES[exampleIdx]
    if (!isDeleting && typedText === current) {
      const t = setTimeout(() => setIsDeleting(true), 2000)
      return () => clearTimeout(t)
    }
    if (isDeleting && typedText === '') {
      const t = setTimeout(() => {
        setIsDeleting(false)
        setExampleIdx(i => (i + 1) % EXAMPLES.length)
      }, 500)
      return () => clearTimeout(t)
    }
    const delay = isDeleting ? 32 : 72
    const t = setTimeout(() => {
      setTypedText(isDeleting
        ? current.slice(0, typedText.length - 1)
        : current.slice(0, typedText.length + 1),
      )
    }, delay)
    return () => clearTimeout(t)
  }, [typedText, isDeleting, exampleIdx, focused, value])

  const submit = async () => {
    if (!value.trim() || loading) return
    setLoading(true)
    setStatus('thinking')
    try {
      await onAdd(value.trim())
      setStatus('done')
      onChange('')
      setTimeout(() => { setStatus('idle'); setLoading(false) }, 700)
    } catch {
      setStatus('error')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'relative', borderRadius: 20, padding: '32px 24px',
      overflow: 'hidden', marginBottom: 32,
      border: `1px solid ${focused ? 'rgba(249,115,22,0.35)' : 'rgba(249,115,22,0.14)'}`,
      transition: 'border-color 0.3s',
    }}>
      {/* Gradient section background */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none',
        background: focused
          ? 'linear-gradient(135deg, rgba(249,115,22,0.13) 0%, rgba(129,140,248,0.10) 50%, rgba(249,115,22,0.09) 100%)'
          : 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(129,140,248,0.05) 50%, rgba(249,115,22,0.04) 100%)',
        transition: 'background 0.5s',
      }} />
      {/* Orange blob top-left */}
      <div style={{
        position: 'absolute', top: -40, left: '25%', pointerEvents: 'none', borderRadius: '50%',
        width: focused ? 340 : 256, height: focused ? 180 : 128,
        background: 'radial-gradient(ellipse, rgba(249,115,22,0.28) 0%, transparent 70%)',
        filter: 'blur(22px)', opacity: focused ? 1 : 0.7,
        transition: 'all 0.6s ease',
      }} />
      {/* Indigo blob bottom-right */}
      <div style={{
        position: 'absolute', bottom: -32, right: '33%', pointerEvents: 'none', borderRadius: '50%',
        width: focused ? 280 : 192, height: focused ? 160 : 96,
        background: 'radial-gradient(ellipse, rgba(129,140,248,0.22) 0%, transparent 70%)',
        filter: 'blur(18px)', opacity: focused ? 1 : 0.7,
        transition: 'all 0.6s ease',
      }} />

      {/* Label */}
      <p style={{
        position: 'relative', textAlign: 'center',
        fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'var(--text-mute)', marginBottom: 16, fontFamily: 'var(--font-mono)',
      }}>
        What&apos;s your next goal?
      </p>

      {/* Gradient-border pill */}
      <div style={{
        position: 'relative', borderRadius: 30, padding: 1.5,
        background: focused
          ? 'linear-gradient(135deg, rgba(249,115,22,0.9), rgba(129,140,248,0.7), rgba(249,115,22,0.6))'
          : 'linear-gradient(135deg, rgba(249,115,22,0.45), rgba(129,140,248,0.3), rgba(249,115,22,0.25))',
        boxShadow: focused
          ? '0 0 0 4px rgba(249,115,22,0.12), 0 8px 32px rgba(249,115,22,0.15)'
          : '0 4px 24px rgba(0,0,0,0.35)',
        transition: 'background 0.25s, box-shadow 0.25s',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          borderRadius: 28, padding: '0 20px', height: 60,
          background: '#0a0a16',
        }}>
          <span style={{
            color: 'var(--accent)', fontSize: 15, flexShrink: 0, lineHeight: 1,
            opacity: focused ? 1 : 0.6, transition: 'opacity 0.2s', userSelect: 'none',
          }}>✦</span>

          {/* Input + animated placeholder */}
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              style={{
                width: '100%', background: 'transparent',
                border: 'none', outline: 'none',
                fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-display)',
              }}
            />
            {!value && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                pointerEvents: 'none', overflow: 'hidden', whiteSpace: 'nowrap',
                fontSize: 15, fontFamily: 'var(--font-display)', color: 'rgba(232,232,240,0.28)',
              }}>
                {focused
                  ? <span style={{ color: 'rgba(232,232,240,0.18)' }}>Describe a goal...</span>
                  : <>e.g.&nbsp;{typedText}<span className="add-goal-cursor">|</span></>
                }
              </div>
            )}
          </div>

          {/* Submit button */}
          {value.trim() ? (
            <button
              onClick={submit}
              disabled={loading}
              style={{
                flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
                background: loading ? 'color-mix(in oklab, var(--accent) 50%, transparent)' : 'var(--accent)',
                border: 'none', cursor: loading ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 16px rgba(249,115,22,0.5)',
                transition: 'background 0.15s',
              }}
            >
              {loading
                ? <span style={{ fontSize: 14, color: 'white', fontFamily: 'var(--font-mono)' }}>···</span>
                : (
                  <svg width="15" height="15" fill="none" viewBox="0 0 16 16">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              }
            </button>
          ) : (
            <div style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
              border: '1px solid rgba(249,115,22,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 16 16">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="rgba(249,115,22,0.35)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Category chips */}
      <div style={{
        position: 'relative', display: 'flex', flexWrap: 'wrap',
        justifyContent: 'center', gap: '6px 20px', marginTop: 16,
      }}>
        {CATEGORY_CHIPS.map(chip => (
          <button
            key={chip.label}
            onClick={() => onChange(chip.prompt)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 0',
              color: 'rgba(232,232,240,0.3)', transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(232,232,240,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(232,232,240,0.3)' }}
          >
            {chip.emoji} {chip.label}
          </button>
        ))}
      </div>

      {/* Status feedback */}
      {status === 'thinking' && <p style={{ position: 'relative', marginTop: 10, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>◉ AI is forging your plan···</p>}
      {status === 'done'     && <p style={{ position: 'relative', marginTop: 10, fontSize: 12, color: 'var(--ring-2)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>✓ Goal added!</p>}
      {status === 'error'    && <p style={{ position: 'relative', marginTop: 10, fontSize: 12, color: 'var(--rose)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>✕ Could not create goal — check your connection and try again.</p>}
    </div>
  )
}
