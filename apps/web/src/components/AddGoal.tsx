import { useState, useEffect } from 'react'
import Icon from './ui/Icon'

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
    <div className="gf-create-wrap">
      {/* Ambient blobs (CSS-driven, no JS state) */}
      <div className="gf-create-amb" aria-hidden="true">
        <span className="gf-amb o1" /><span className="gf-amb o2" />
      </div>

      <div className={`gf-create${focused ? ' is-focus' : ''}`}>
        <div className="gf-create-bg" />
        <div className="gf-create-blob a" />
        <div className="gf-create-blob b" />

        <div className="gf-create-in">
          <div className="gf-create-eyebrow">What&apos;s your next goal?</div>

          <div className="gf-create-pillwrap">
            <div className="gf-create-pill">
              <span className="gf-create-star">
                <Icon name="spark" size={17} />
              </span>

              <div className="gf-create-field">
                <input
                  className="gf-create-input"
                  type="text"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={e => { if (e.key === 'Enter') void submit() }}
                  aria-label="Describe your goal"
                />
                {!value && (
                  <div className="gf-create-ph">
                    {focused
                      ? <span className="dim">Describe a goal…</span>
                      : <>e.g.&nbsp;{typedText}<span className="gf-caret">|</span></>
                    }
                  </div>
                )}
              </div>

              <button
                className={`gf-create-go${value.trim() ? ' is-on' : ''}`}
                onClick={() => void submit()}
                disabled={loading}
                aria-label="Create goal"
              >
                {loading
                  ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>···</span>
                  : <Icon name="arrowUp" size={18} stroke={2.4} />
                }
              </button>
            </div>
          </div>

          <div className="gf-create-chips">
            {CATEGORY_CHIPS.map(chip => (
              <button
                key={chip.label}
                className="gf-create-chip"
                onClick={() => onChange(chip.prompt)}
              >
                {chip.emoji} {chip.label}
              </button>
            ))}
          </div>

          {status === 'thinking' && <div className="gf-create-status think">◉ AI is forging your plan…</div>}
          {status === 'done'     && <div className="gf-create-status done">✓ Goal added!</div>}
          {status === 'error'    && <div className="gf-create-status error">✕ Could not create goal — try again.</div>}
        </div>
      </div>
    </div>
  )
}
