import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/theme'
import { Creature } from '../components/GamificationSvgs'

const ONBOARDING_COMPLETE_KEY = 'goalforge_onboarding_complete'
const ONBOARDING_STEP_KEY = 'goalforge_onboarding_step'

const CATEGORIES = [
  { id: 'health',       label: 'Health & Fitness',   icon: '🏋️', desc: 'Exercise, nutrition, sleep' },
  { id: 'career',       label: 'Career & Skills',     icon: '💼', desc: 'Work goals, promotions, skills' },
  { id: 'learning',     label: 'Learning',            icon: '📚', desc: 'Courses, languages, reading' },
  { id: 'finance',      label: 'Finance',             icon: '💰', desc: 'Savings, investments, budgeting' },
  { id: 'relationships',label: 'Relationships',       icon: '❤️', desc: 'Family, friendships, community' },
  { id: 'personal',     label: 'Personal Growth',     icon: '✨', desc: 'Mindset, habits, creativity' },
]

const HOW_IT_WORKS = [
  {
    icon: '🤖',
    title: 'AI builds your SMART plan',
    body: 'Describe any goal in plain language. Gemini AI converts it into a structured, time-bound plan with clear milestones.',
  },
  {
    icon: '📅',
    title: 'Daily tasks keep you on track',
    body: 'Each day you get focused bite-sized tasks assigned automatically. No overwhelm — just the next right step.',
  },
  {
    icon: '⭐',
    title: 'Complete tasks, earn stars, evolve',
    body: 'Every completed task earns star points. Accumulate them to evolve your creature from a tiny Speck all the way to Celestial.',
  },
]

// ── Shared layout wrappers ─────────────────────────────────────────────────────

interface CardProps { children: React.ReactNode }
function Card({ children }: CardProps) {
  const T = useT()
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 20,
      padding: '40px 32px',
      maxWidth: 520,
      width: '100%',
      boxShadow: `0 0 60px ${T.indigo}10`,
      animation: 'fadeUp 0.35s ease both',
    }}>
      {children}
    </div>
  )
}

// ── Step 1: Welcome ────────────────────────────────────────────────────────────

function StepWelcome() {
  const T = useT()
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
        <Creature pts={0} size={120} />
      </div>
      <h1 style={{
        fontFamily: T.serif, fontSize: 30, fontWeight: 600,
        color: T.text, marginBottom: 12, lineHeight: 1.25,
      }}>
        Welcome to Goal<span style={{ color: T.orange }}>Forge</span>
      </h1>
      <p style={{
        fontFamily: T.mono, fontSize: 13, color: T.textDim,
        lineHeight: 1.8, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px',
      }}>
        GoalForge turns your ambitions into a structured, AI-powered action plan — with daily tasks, milestones, and a star creature that evolves as you make progress.
      </p>
      <p style={{
        fontFamily: T.mono, fontSize: 12, color: T.muted,
        lineHeight: 1.7,
      }}>
        This quick setup takes about 60 seconds. Let's build something great together.
      </p>
    </div>
  )
}

// ── Step 2: Pick your focus area ──────────────────────────────────────────────

interface StepCategoryProps {
  selected: string | null
  onSelect: (id: string) => void
}

function StepCategory({ selected, onSelect }: StepCategoryProps) {
  const T = useT()
  return (
    <div>
      <h2 style={{
        fontFamily: T.serif, fontSize: 22, fontWeight: 600,
        color: T.text, marginBottom: 6, textAlign: 'center',
      }}>
        Pick your focus area
      </h2>
      <p style={{
        fontFamily: T.mono, fontSize: 12, color: T.muted,
        textAlign: 'center', marginBottom: 24, lineHeight: 1.6,
      }}>
        What area of your life do you want to level up first?
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
      }}>
        {CATEGORIES.map(cat => {
          const isSelected = selected === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              style={{
                background: isSelected ? `${T.indigo}18` : T.surface,
                border: `1px solid ${isSelected ? T.indigo : T.border}`,
                borderRadius: 12,
                padding: '14px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s, border-color 0.15s',
                minHeight: 44,
              }}
              onMouseEnter={e => {
                if (!isSelected) {
                  e.currentTarget.style.background = `${T.indigo}0c`
                  e.currentTarget.style.borderColor = `${T.indigo}50`
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.background = T.surface
                  e.currentTarget.style.borderColor = T.border
                }
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 5 }}>{cat.icon}</div>
              <div style={{
                fontFamily: T.mono, fontSize: 12, fontWeight: 600,
                color: isSelected ? T.indigo : T.text, marginBottom: 2,
              }}>
                {cat.label}
              </div>
              <div style={{
                fontFamily: T.mono, fontSize: 10, color: T.muted, lineHeight: 1.4,
              }}>
                {cat.desc}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 3: How it works ──────────────────────────────────────────────────────

function StepHowItWorks() {
  const T = useT()
  return (
    <div>
      <h2 style={{
        fontFamily: T.serif, fontSize: 22, fontWeight: 600,
        color: T.text, marginBottom: 6, textAlign: 'center',
      }}>
        Here's how it works
      </h2>
      <p style={{
        fontFamily: T.mono, fontSize: 12, color: T.muted,
        textAlign: 'center', marginBottom: 24, lineHeight: 1.6,
      }}>
        Three simple steps stand between you and your goal.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {HOW_IT_WORKS.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex', gap: 16, alignItems: 'flex-start',
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: '16px 18px',
              animation: `fadeUp ${0.25 + i * 0.1}s ease both`,
            }}
          >
            <div style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{item.icon}</div>
            <div>
              <div style={{
                fontFamily: T.mono, fontSize: 13, fontWeight: 600,
                color: T.text, marginBottom: 4,
              }}>
                {item.title}
              </div>
              <div style={{
                fontFamily: T.mono, fontSize: 11, color: T.textDim, lineHeight: 1.7,
              }}>
                {item.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 4: Set first goal ─────────────────────────────────────────────────────

interface StepFirstGoalProps {
  goalText: string
  onGoalChange: (v: string) => void
  onSubmit: () => void
}

function StepFirstGoal({ goalText, onGoalChange, onSubmit }: StepFirstGoalProps) {
  const T = useT()
  return (
    <div>
      <h2 style={{
        fontFamily: T.serif, fontSize: 22, fontWeight: 600,
        color: T.text, marginBottom: 6, textAlign: 'center',
      }}>
        Set your first goal
      </h2>
      <p style={{
        fontFamily: T.mono, fontSize: 12, color: T.muted,
        textAlign: 'center', marginBottom: 24, lineHeight: 1.6,
      }}>
        What do you want to achieve in the next 90 days?
      </p>
      <textarea
        value={goalText}
        onChange={e => onGoalChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit() }}
        placeholder="e.g. I want to run a 5K by end of June, learn the basics of Spanish, build a consistent savings habit..."
        rows={4}
        autoFocus
        style={{
          width: '100%', background: T.surface, border: `1px solid ${T.borderHi}`,
          borderRadius: 10, padding: '13px 14px', color: T.text, fontFamily: T.mono,
          fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box',
          marginBottom: 14, lineHeight: 1.6,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = T.orange }}
        onBlur={e => { e.currentTarget.style.borderColor = T.borderHi }}
      />
      <button
        onClick={onSubmit}
        disabled={!goalText.trim()}
        style={{
          width: '100%', minHeight: 48, padding: '13px 22px', borderRadius: 10,
          cursor: goalText.trim() ? 'pointer' : 'not-allowed',
          fontFamily: T.mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
          background: goalText.trim() ? T.orange : `${T.orange}40`,
          color: goalText.trim() ? '#fff' : `${T.text}60`,
          border: 'none',
          transition: 'background 0.2s, opacity 0.2s',
        }}
      >
        Create My Goal →
      </button>
      <p style={{
        fontFamily: T.mono, fontSize: 10, color: T.muted,
        textAlign: 'center', marginTop: 10, lineHeight: 1.5,
      }}>
        Tip: Don't worry about being perfect — AI will refine it into a SMART goal.
        <br />Press Cmd+Enter to submit.
      </p>
    </div>
  )
}

// ── Progress indicator ─────────────────────────────────────────────────────────

interface ProgressProps { step: number; total: number }
function ProgressDots({ step, total }: ProgressProps) {
  const T = useT()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28,
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === step - 1 ? 20 : 8,
            height: 8,
            borderRadius: 4,
            background: i < step ? T.indigo : T.dim,
            transition: 'width 0.25s ease, background 0.25s ease',
          }}
        />
      ))}
      <span style={{
        fontFamily: T.mono, fontSize: 10, color: T.muted, marginLeft: 6,
      }}>
        {step} of {total}
      </span>
    </div>
  )
}

// ── Navigation buttons ─────────────────────────────────────────────────────────

interface NavProps {
  step: number
  totalSteps: number
  canNext: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}
function NavButtons({ step, totalSteps, canNext, onBack, onNext, onSkip }: NavProps) {
  const T = useT()
  const isLast = step === totalSteps
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginTop: 28,
    }}>
      {step > 1 && (
        <button
          onClick={onBack}
          style={{
            minHeight: 44, padding: '10px 20px', borderRadius: 9, cursor: 'pointer',
            fontFamily: T.mono, fontSize: 12, color: T.textDim,
            background: T.surface, border: `1px solid ${T.border}`,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border }}
        >
          ← Back
        </button>
      )}
      {/* Only show Next if not on last step (last step has its own CTA) */}
      {!isLast && (
        <button
          onClick={onNext}
          disabled={!canNext}
          style={{
            flex: 1, minHeight: 44, padding: '10px 22px', borderRadius: 9,
            cursor: canNext ? 'pointer' : 'not-allowed',
            fontFamily: T.mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
            background: canNext ? `${T.indigo}22` : `${T.indigo}0a`,
            color: canNext ? T.indigo : T.dim,
            border: `1px solid ${canNext ? T.indigo + '60' : T.border}`,
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          {step === 1 ? 'Get Started →' : 'Next →'}
        </button>
      )}
      <button
        onClick={onSkip}
        style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: T.mono, fontSize: 10, color: T.muted, padding: '4px 8px',
          minHeight: 44,
        }}
      >
        Skip for now
      </button>
    </div>
  )
}

// ── Main Onboarding page ───────────────────────────────────────────────────────

export default function Onboarding() {
  const T = useT()
  const navigate = useNavigate()
  const savedStep = parseInt(localStorage.getItem(ONBOARDING_STEP_KEY) ?? '1', 10)
  const [step, setStep] = useState<number>(isNaN(savedStep) ? 1 : Math.min(savedStep, 4))
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    localStorage.getItem('onboarding_category')
  )
  const [goalText, setGoalText] = useState('')

  // Persist step
  useEffect(() => {
    localStorage.setItem(ONBOARDING_STEP_KEY, String(step))
  }, [step])

  useEffect(() => { document.title = 'Welcome — GoalForge' }, [])

  const TOTAL = 4

  function handleCategorySelect(id: string) {
    setSelectedCategory(id)
    localStorage.setItem('onboarding_category', id)
  }

  function canProceed(): boolean {
    if (step === 2) return selectedCategory !== null
    return true
  }

  function handleNext() {
    if (!canProceed()) return
    setStep(s => Math.min(s + 1, TOTAL))
  }

  function handleBack() {
    setStep(s => Math.max(s - 1, 1))
  }

  function complete(goalParam?: string) {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
    localStorage.removeItem(ONBOARDING_STEP_KEY)
    const url = goalParam ? `/dashboard?goal=${encodeURIComponent(goalParam)}` : '/dashboard'
    navigate(url, { replace: true })
  }

  function handleCreateGoal() {
    if (!goalText.trim()) return
    complete(goalText.trim())
  }

  function handleSkip() {
    complete()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      color: T.text,
      fontFamily: T.mono,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        textarea:focus { border-color: ${T.orange} !important; outline: none; }
        button:focus-visible { outline: 2px solid ${T.indigo}; outline-offset: 2px; border-radius: 4px; }
      `}</style>

      {/* Logo */}
      <div style={{
        fontFamily: T.serif, fontSize: 20, color: T.text,
        marginBottom: 28, letterSpacing: '-0.2px',
      }}>
        Goal<span style={{ color: T.orange }}>Forge</span>
      </div>

      <ProgressDots step={step} total={TOTAL} />

      <Card>
        {step === 1 && <StepWelcome />}
        {step === 2 && (
          <StepCategory
            selected={selectedCategory}
            onSelect={handleCategorySelect}
          />
        )}
        {step === 3 && <StepHowItWorks />}
        {step === 4 && (
          <StepFirstGoal
            goalText={goalText}
            onGoalChange={setGoalText}
            onSubmit={handleCreateGoal}
          />
        )}

        <NavButtons
          step={step}
          totalSteps={TOTAL}
          canNext={canProceed()}
          onBack={handleBack}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      </Card>
    </div>
  )
}
