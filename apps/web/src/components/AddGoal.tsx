import { useState, useEffect } from 'react'
import { T } from '../lib/theme'
import Btn from './ui/Btn'
import GoalTemplates from './GoalTemplates'

const QUICK_PROMPTS = [
  { label: '🏋️ Get fit',         prompt: 'I want to build a consistent workout habit and lose 15 pounds over the next 3 months' },
  { label: '📚 Learn something',  prompt: 'I want to learn the basics of Python programming in 6 weeks' },
  { label: '💰 Financial goal',   prompt: 'Save $5,000 for an emergency fund by the end of the year' },
  { label: '✍️ Creative project', prompt: 'Write the first draft of my novel — 50,000 words in 2 months' },
  { label: '🧘 Wellness',         prompt: 'Build a daily meditation practice, starting with 5 minutes and working up to 20' },
]

interface AddGoalProps {
  onAdd: (rawInput: string) => Promise<void>
  value: string
  onChange: (v: string) => void
  /** Pre-fill the textarea once on mount (e.g. passed in from the onboarding flow). */
  defaultValue?: string
}

export default function AddGoal({ onAdd, value, onChange, defaultValue }: AddGoalProps) {
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState<'idle' | 'thinking' | 'done' | 'error'>('idle')

  // Apply defaultValue once on mount — only if the parent hasn't already seeded a value.
  useEffect(() => {
    if (defaultValue && !value) {
      onChange(defaultValue)
    }
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
      setTimeout(() => { setStatus('idle'); setLoading(false) }, 700)
    } catch {
      setStatus('error')
      setLoading(false)
    }
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.orange}55`, borderRadius: 13, padding: 18, marginBottom: 22 }}>
      <div style={{ fontSize: 10, color: T.orange, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 11 }}>
        DESCRIBE YOUR GOAL — AI WILL REFINE IT
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        placeholder="e.g. get better at leetcode, run a 5k, write a novel..."
        rows={3}
        style={{
          width: '100%', background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 7, padding: '11px 13px', color: T.text, fontFamily: T.mono,
          fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box',
        }}
      />
      {!value && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
          {QUICK_PROMPTS.map(t => (
            <button
              key={t.label}
              onClick={() => onChange(t.prompt)}
              style={{
                cursor: 'pointer', minHeight: 44, padding: '8px 13px', borderRadius: 20,
                fontFamily: T.mono, fontSize: 11, letterSpacing: '0.03em',
                background: `${T.indigo}12`, color: T.indigo,
                border: `1px solid ${T.indigo}35`,
                transition: 'background 0.15s, border-color 0.15s',
                lineHeight: 1.3,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${T.indigo}22`
                e.currentTarget.style.borderColor = `${T.indigo}60`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${T.indigo}12`
                e.currentTarget.style.borderColor = `${T.indigo}35`
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {status === 'thinking' && <div style={{ marginTop: 10, fontSize: 12, color: T.orange, fontFamily: T.mono }}>◉ AI is forging your plan···</div>}
      {status === 'done'     && <div style={{ marginTop: 10, fontSize: 12, color: T.emerald, fontFamily: T.mono }}>✓ Goal added!</div>}
      {status === 'error'    && <div style={{ marginTop: 10, fontSize: 12, color: T.rose, fontFamily: T.mono }}>✕ Could not create goal — check your connection and try again.</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <Btn onClick={submit} loading={loading}>Create Goal →</Btn>
      </div>
      <GoalTemplates onSelect={onChange} />
    </div>
  )
}
