import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creature } from '../components/GamificationSvgs'

const ONBOARDING_COMPLETE_KEY = 'goalforge_onboarding_complete'
const ONBOARDING_STEP_KEY = 'goalforge_onboarding_step'
const TOTAL_STEPS = 4

const CATEGORIES = [
  { id: 'health',        label: 'Health & Fitness',  icon: '🏋️', desc: 'Exercise, nutrition, sleep' },
  { id: 'career',        label: 'Career & Skills',   icon: '💼', desc: 'Work goals, promotions, skills' },
  { id: 'learning',      label: 'Learning',           icon: '📚', desc: 'Courses, languages, reading' },
  { id: 'finance',       label: 'Finance',            icon: '💰', desc: 'Savings, investments, budgeting' },
  { id: 'relationships', label: 'Relationships',      icon: '❤️', desc: 'Family, friendships, community' },
  { id: 'personal',      label: 'Personal Growth',    icon: '✨', desc: 'Mindset, habits, creativity' },
]

const HOW_STEPS = [
  { icon: '🤖', color: 'var(--accent)',  title: 'AI builds your SMART plan',    body: 'Describe any goal in plain language. It becomes a structured, time-bound plan with clear milestones.' },
  { icon: '📅', color: 'var(--indigo)', title: 'Daily tasks keep you on track', body: "Each day you get focused, bite-sized tasks. No overwhelm — just the next right step." },
  { icon: '⭐', color: 'var(--gold)',   title: 'Earn stars, evolve your creature', body: 'Every finished task earns star points. Grow from Speck all the way to Celestial.' },
]

const PROMPTS = [
  'Run a 5K by end of June',
  'Build a consistent morning routine',
  'Save €2k in 3 months',
  'Read 12 books this year',
  'Launch a side project',
  'Learn basic Spanish conversation',
]

// ── Step 1 ─────────────────────────────────────────────────────────────────────
function StepWelcome() {
  return (
    <>
      <div className="ob-mascot"><Creature pts={0} size={110} /></div>
      <div className="ob-eyebrow">Hi, I'm Solly · your goal buddy</div>
      <h1 className="ob-title">Welcome to Goal<span>Forge</span></h1>
      <p className="ob-sub">Tell me what you're chasing and I'll turn it into a structured, AI-powered plan — daily tasks, milestones, and a star creature that grows brighter as you do.</p>
      <div className="ob-pills">
        <span className="ob-pill">⏱ ~60 second setup</span>
        <span className="ob-pill">✓ Free to start</span>
        <span className="ob-pill">🔔 Gentle nudges, never nags</span>
      </div>
    </>
  )
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────
function StepFocus({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  return (
    <>
      <div className="ob-eyebrow">Where should we start?</div>
      <h1 className="ob-title">Pick your focus area</h1>
      <p className="ob-sub">What part of your life do you want to level up first? You can add more later.</p>
      <div className="ob-focus-grid">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={['ob-focus-card', selected === cat.id && 'sel'].filter(Boolean).join(' ')}
            aria-pressed={selected === cat.id}
          >
            <div className="ob-fc-ic">{cat.icon}</div>
            <div>
              <span className="ob-fc-name">{cat.label}</span>
              <span className="ob-fc-desc">{cat.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

// ── Step 3 ─────────────────────────────────────────────────────────────────────
function StepHowItWorks() {
  return (
    <>
      <div className="ob-eyebrow">The simple part</div>
      <h1 className="ob-title">Here&apos;s how it works</h1>
      <p className="ob-sub">Three steps stand between you and your goal.</p>
      <div className="ob-how-list">
        {HOW_STEPS.map((s, i) => (
          <div key={i} className="ob-how-row">
            <div className="ob-how-ic" style={{ background: `color-mix(in oklab, ${s.color} 14%, transparent)` }}>{s.icon}</div>
            <div>
              <div className="ob-how-h">{s.title}</div>
              <div className="ob-how-p">{s.body}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Step 4 ─────────────────────────────────────────────────────────────────────
function StepGoal({ goalText, onChange, onSubmit }: {
  goalText: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  const [focused, setFocused] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { taRef.current?.focus() }, [])

  return (
    <>
      <div className="ob-eyebrow">The fun part</div>
      <h1 className="ob-title">Set your first goal</h1>
      <p className="ob-sub">What do you want to achieve in the next 90 days?</p>

      <div style={{ marginTop: 22 }}>
        <div className={['ob-goal-pillwrap', focused && 'focus'].filter(Boolean).join(' ')}>
          <div className="ob-goal-field">
            <span className="ob-goal-star">★</span>
            <textarea
              ref={taRef}
              className="ob-goal-input"
              rows={3}
              value={goalText}
              onChange={e => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit() }}
              placeholder="e.g. Run a 5K by the end of June, learn the basics of Spanish, build a consistent savings habit…"
            />
          </div>
        </div>

        <div className="ob-goal-chips">
          {PROMPTS.map(p => (
            <button key={p} className="ob-gchip" onClick={() => onChange(p)}>{p}</button>
          ))}
        </div>

        <div className="ob-goal-tip">
          ⓘ Don&apos;t worry about being perfect — AI will shape it into a SMART goal. Cmd+Enter to submit.
        </div>
      </div>
    </>
  )
}

// ── Step dots ──────────────────────────────────────────────────────────────────
function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="ob-stepper" role="progressbar" aria-label="Onboarding progress" aria-valuenow={step} aria-valuemax={total}>
      <div className="ob-steps">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={['ob-dot', i < step - 1 && 'done', i === step - 1 && 'active'].filter(Boolean).join(' ')}
          />
        ))}
      </div>
      <div className="ob-step-count">{step} of {total}</div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate()

  const [step, setStep] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem(ONBOARDING_STEP_KEY) ?? '1', 10)
    return isNaN(saved) ? 1 : Math.min(saved, TOTAL_STEPS)
  })
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => localStorage.getItem('onboarding_category')
  )
  const [goalText, setGoalText] = useState('')

  useEffect(() => {
    localStorage.setItem(ONBOARDING_STEP_KEY, String(step))
  }, [step])

  useEffect(() => { document.title = 'Welcome — GoalForge' }, [])

  function handleCategorySelect(id: string) {
    setSelectedCategory(id)
    localStorage.setItem('onboarding_category', id)
  }

  function canProceed() {
    if (step === 2) return selectedCategory !== null
    return true
  }

  function complete(goalParam?: string) {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
    localStorage.removeItem(ONBOARDING_STEP_KEY)
    const url = goalParam ? `/dashboard?goal=${encodeURIComponent(goalParam)}` : '/dashboard'
    navigate(url, { replace: true })
  }

  function handleNext() {
    if (!canProceed()) return
    if (step < TOTAL_STEPS) setStep(s => s + 1)
  }

  function handleBack() {
    setStep(s => Math.max(s - 1, 1))
  }

  function handleCreateGoal() {
    if (!goalText.trim()) return
    complete(goalText.trim())
  }

  function handleSkip() {
    complete()
  }

  const isLastStep = step === TOTAL_STEPS

  return (
    <div className="ob-shell">
      <div className="ob-brand">Goal<span>Forge</span></div>

      <Stepper step={step} total={TOTAL_STEPS} />

      <div className="ob-stage">
        <div className="ob-card">
          {step === 1 && <StepWelcome />}
          {step === 2 && <StepFocus selected={selectedCategory} onSelect={handleCategorySelect} />}
          {step === 3 && <StepHowItWorks />}
          {step === 4 && (
            <StepGoal
              goalText={goalText}
              onChange={setGoalText}
              onSubmit={handleCreateGoal}
            />
          )}

          <div className="ob-nav">
            {step > 1 && (
              <button onClick={handleBack} className="ob-btn-back">← Back</button>
            )}
            {!isLastStep ? (
              <button onClick={handleNext} disabled={!canProceed()} className="ob-btn-primary">
                {step === 1 ? 'Get started →' : 'Next →'}
              </button>
            ) : (
              <button onClick={handleCreateGoal} disabled={!goalText.trim()} className="ob-btn-primary">
                Forge my goal ✨
              </button>
            )}
            <button onClick={handleSkip} className="ob-btn-skip">Skip for now</button>
          </div>
        </div>
      </div>
    </div>
  )
}
