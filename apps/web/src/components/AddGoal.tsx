import { useState, useEffect, useRef } from 'react'
import Icon from './ui/Icon'

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

const CATEGORY_CHIPS = [
  { icon: 'run', label: 'Get fit', prompt: 'I want to build a consistent workout habit and lose 15 pounds over the next 3 months' },
  { icon: 'book', label: 'Learn something', prompt: 'I want to learn the basics of Python programming in 6 weeks' },
  { icon: 'bolt', label: 'Financial goal', prompt: 'Save $5,000 for an emergency fund by the end of the year' },
  { icon: 'spark', label: 'Creative project', prompt: 'Write the first draft of my novel — 50,000 words in 2 months' },
  { icon: 'heart', label: 'Wellness', prompt: 'Build a daily meditation practice, starting with 5 minutes and working up to 20' },
]

const TYPE_EXAMPLES = [
  'run a 5k in 8 weeks', 'ship my side project this month', 'read 12 books this year',
  'learn Spanish in 6 months', 'wake up at 6am every day', 'save $5,000 by August',
]

// Typewriter placeholder. State lives in a ref; the state setter only receives a
// plain string, so the render stays pure (no Date/side-effects in render body).
function useTypewriter(active: boolean) {
  const [txt, setTxt] = useState('')
  const ref = useRef({ i: 0, pos: 0, deleting: false })
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const s = ref.current
      const cur = TYPE_EXAMPLES[s.i]
      let delay = 70
      if (!s.deleting) {
        s.pos++
        if (s.pos >= cur.length) { s.deleting = true; delay = 1900 }
      } else {
        s.pos--
        if (s.pos <= 0) { s.deleting = false; s.i = (s.i + 1) % TYPE_EXAMPLES.length; delay = 360 }
      }
      setTxt(cur.slice(0, Math.max(0, s.pos)))
      timer = setTimeout(tick, delay)
    }
    timer = setTimeout(tick, 400)
    return () => clearTimeout(timer)
  }, [active])
  return txt
}

interface AddGoalProps {
  onAdd: (rawInput: string) => Promise<void>
  value: string
  onChange: (v: string) => void
  /** Pre-fill the textarea once on mount (e.g. passed in from the onboarding flow). */
  defaultValue?: string
}

export default function AddGoal({ onAdd, value, onChange, defaultValue }: AddGoalProps) {
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [status, setStatus] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle')
  const typed = useTypewriter(!focused && !value)

  // Apply defaultValue once on mount — only if the parent hasn't already seeded a value.
  useEffect(() => {
    if (defaultValue && !value) onChange(defaultValue)
    // Intentionally runs only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!value.trim() || loading) return
    setLoading(true)
    setStatus('thinking')
    try {
      await onAdd(value.trim())
      setStatus('done')
      onChange('')
      setTimeout(() => { setStatus('idle'); setLoading(false) }, 1100)
    } catch {
      setStatus('error')
      setLoading(false)
    }
  }

  return (
    <div className="gf-create-wrap" style={{ marginBottom: 22 }}>
      <div className="gf-create-amb" aria-hidden="true">
        <span className="gf-amb o1" /><span className="gf-amb o2" />
      </div>
      <div className={cx('gf-create', focused && 'is-focus')}>
        <div className="gf-create-bg" />
        <div className="gf-create-blob a" />
        <div className="gf-create-blob b" />
        <div className="gf-create-in">
          <div className="gf-create-eyebrow">What's your next goal?</div>
          <div className="gf-create-pillwrap">
            <div className="gf-create-pill">
              <span className="gf-create-star"><Icon name="spark" size={17} /></span>
              <div className="gf-create-field">
                <input
                  className="gf-create-input"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={e => { if (e.key === 'Enter') submit() }}
                  aria-label="Describe your goal"
                />
                {!value && (
                  <div className="gf-create-ph">
                    {focused
                      ? <span className="dim">Describe a goal…</span>
                      : <>e.g.&nbsp;{typed}<span className="gf-caret">|</span></>}
                  </div>
                )}
              </div>
              <button
                className={cx('gf-create-go', value.trim() && 'is-on')}
                onMouseDown={e => e.preventDefault()}
                onClick={submit}
                aria-label="Create goal"
                disabled={loading}
              >
                {status === 'thinking' ? <span>···</span> : <Icon name="arrowUp" size={18} stroke={2.4} />}
              </button>
            </div>
          </div>
          <div className="gf-create-chips">
            {CATEGORY_CHIPS.map(c => (
              <button key={c.label} className="gf-create-chip" onClick={() => onChange(c.prompt)}>
                <Icon name={c.icon} size={13} /> {c.label}
              </button>
            ))}
          </div>
          {status === 'thinking' && <div className="gf-create-status think">◉ AI is forging your plan…</div>}
          {status === 'done' && <div className="gf-create-status done"><Icon name="check" size={12} stroke={3} /> Goal added!</div>}
          {status === 'error' && <div className="gf-create-status error">✕ Could not create goal — check your connection and try again.</div>}
        </div>
      </div>
    </div>
  )
}
