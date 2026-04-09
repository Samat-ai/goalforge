import { useState } from 'react'
import { T } from '../lib/theme'
import Btn from './ui/Btn'

const TEMPLATES = [
  { label: '🏋️ Get fit',         prompt: 'I want to build a consistent workout habit and lose 15 pounds over the next 3 months' },
  { label: '📚 Learn something',  prompt: 'I want to learn the basics of Python programming in 6 weeks' },
  { label: '💰 Financial goal',   prompt: 'Save $5,000 for an emergency fund by the end of the year' },
  { label: '✍️ Creative project', prompt: 'Write the first draft of my novel — 50,000 words in 2 months' },
  { label: '🧘 Wellness',         prompt: 'Build a daily meditation practice, starting with 5 minutes and working up to 20' },
]

const MIN_CHARS = 10
const MAX_CHARS = 500
const COUNTER_WARN_AT = 450

interface AddGoalProps {
  onAdd: (rawInput: string) => Promise<void>
  value: string
  onChange: (v: string) => void
}

function getValidationError(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed.length === 0) return null // no error shown when empty/untouched
  if (trimmed.length < MIN_CHARS) return `Please describe your goal in more detail (min ${MIN_CHARS} characters)`
  if (text.length > MAX_CHARS) return `Goal must be ${MAX_CHARS} characters or fewer`
  return null
}

export default function AddGoal({ onAdd, value, onChange }: AddGoalProps) {
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState<'idle' | 'thinking' | 'done' | 'error'>('idle')
  const [touched, setTouched] = useState(false)

  const trimmed = value.trim()
  const charCount = value.length
  const validationError = touched ? getValidationError(value) : null
  const isValid = trimmed.length >= MIN_CHARS && charCount <= MAX_CHARS
  const counterColor = charCount >= COUNTER_WARN_AT ? T.rose : T.muted

  const submit = async () => {
    setTouched(true)
    if (!isValid || loading) return
    setLoading(true)
    setStatus('thinking')
    try {
      await onAdd(trimmed)
      setStatus('done')
      onChange('')
      setTouched(false)
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
        onChange={e => { onChange(e.target.value); setTouched(true) }}
        onBlur={() => setTouched(true)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        placeholder="e.g. get better at leetcode, run a 5k, write a novel..."
        rows={3}
        aria-describedby={validationError ? 'goal-error' : undefined}
        aria-invalid={validationError ? true : undefined}
        style={{
          width: '100%', background: T.surface,
          border: `1px solid ${validationError ? T.rose : T.border}`,
          borderRadius: 7, padding: '11px 13px', color: T.text, fontFamily: T.mono,
          fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box',
        }}
      />

      {/* Character counter */}
      {value.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: counterColor }}>
            {charCount} / {MAX_CHARS}
          </span>
        </div>
      )}

      {/* Inline validation error */}
      {validationError && (
        <div
          id="goal-error"
          role="alert"
          style={{ marginTop: 6, fontSize: 12, color: T.rose, fontFamily: T.mono }}
        >
          {validationError}
        </div>
      )}

      {!value && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
          {TEMPLATES.map(t => (
            <button
              key={t.label}
              onClick={() => { onChange(t.prompt); setTouched(false) }}
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
        <Btn onClick={submit} loading={loading} disabled={touched && !isValid}>Create Goal →</Btn>
      </div>
    </div>
  )
}
