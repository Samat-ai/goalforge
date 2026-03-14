import { useState } from 'react'
import { T } from '../lib/theme'
import Btn from './ui/Btn'

interface AddGoalProps {
  onAdd: (rawInput: string) => Promise<void>
  value: string
  onChange: (v: string) => void
}

export default function AddGoal({ onAdd, value, onChange }: AddGoalProps) {
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState<'idle' | 'thinking' | 'done'>('idle')

  const submit = async () => {
    if (!value.trim() || loading) return
    setLoading(true)
    setStatus('thinking')
    await onAdd(value.trim())
    setStatus('done')
    onChange('')
    setTimeout(() => { setStatus('idle'); setLoading(false) }, 700)
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
      {status === 'thinking' && <div style={{ marginTop: 10, fontSize: 12, color: T.orange, fontFamily: T.mono }}>◉ AI is forging your plan···</div>}
      {status === 'done'     && <div style={{ marginTop: 10, fontSize: 12, color: T.emerald, fontFamily: T.mono }}>✓ Goal added!</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <Btn onClick={submit} loading={loading}>Create Goal →</Btn>
      </div>
    </div>
  )
}
