// pages/OnboardingPage.tsx — transcribed verbatim (structure, copy, animation,
// state machine) from `design_handoff_goalforge/app/GoalForge Onboarding.html`,
// a self-contained prototype with its own <style> block (→ ../onboarding.css)
// and inline script driving a 5-panel Solly-greeting flow (welcome → focus →
// how-it-works → set goal → finish/confetti).
//
// Two intentional deviations from the prototype's dead-end script links
// (the prototype is a static mockup, not a real app):
//   - "Skip for now" pointed to a sibling marketing HTML file. Here it
//     completes onboarding (no goal) and lands on /dashboard — same
//     contract/behavior as the previous Onboarding.tsx's skip path.
//   - "Enter GoalForge" pointed to a sibling mockup HTML file. Here it fires
//     the real completion contract: localStorage flag + `/dashboard?goal=`.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import '../onboarding.css'

const ONBOARDING_COMPLETE_KEY = 'goalforge_onboarding_complete'
const TOTAL_STEPS = 4 // welcome..goal counted in the dot stepper; finish (step 4) = "Done"

type FocusId = 'fitness' | 'career' | 'learning' | 'finance' | 'relationships' | 'growth'

const FOCUS: Array<{ id: FocusId; name: string; desc: string; cc: string; icon: () => ReactNode }> = [
  { id: 'fitness', name: 'Health & Fitness', desc: 'Exercise, nutrition, sleep', cc: 'var(--rose)', icon: () => (
    <><path d="M6.5 6.5 17.5 17.5M4 9l-1 1 1 1M20 15l1-1-1-1" /><rect x="5" y="7" width="4" height="10" rx="1.4" /><rect x="15" y="7" width="4" height="10" rx="1.4" /></>
  ) },
  { id: 'career', name: 'Career & Skills', desc: 'Work goals, promotions, skills', cc: 'var(--accent)', icon: () => (
    <><rect x="2.5" y="7" width="19" height="13" rx="2.5" /><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7M2.5 12.5h19" /></>
  ) },
  { id: 'learning', name: 'Learning', desc: 'Courses, languages, reading', cc: 'var(--indigo)', icon: () => (
    <path d="M3 5.5A2 2 0 0 1 5 4h6v15H5a2 2 0 0 0-2 1.5zM21 5.5A2 2 0 0 0 19 4h-6v15h6a2 2 0 0 1 2 1.5z" />
  ) },
  { id: 'finance', name: 'Finance', desc: 'Savings, investing, budgeting', cc: 'var(--gold)', icon: () => (
    <><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><circle cx="12" cy="12.5" r="2.6" /><path d="M6 6V4.5h12V6" /></>
  ) },
  { id: 'relationships', name: 'Relationships', desc: 'Family, friends, community', cc: 'var(--rose)', icon: () => (
    <path d="M12 20s-7-4.5-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.5C19 15.5 12 20 12 20z" />
  ) },
  { id: 'growth', name: 'Personal Growth', desc: 'Mindset, habits, creativity', cc: 'var(--green)', icon: () => (
    <path d="M12 3v18M12 8c0-2.5 2-4.5 5-4.5 0 3-2 4.5-5 4.5zM12 12c0-2.5-2-4.5-5-4.5 0 3 2 4.5 5 4.5z" />
  ) },
]

const CHIPS: Record<FocusId | '_default', string[]> = {
  fitness: ['Run a 5K in 8 weeks', 'Work out 3× a week', 'Sleep 7+ hours nightly'],
  career: ['Ship a portfolio project', 'Get a promotion this year', 'Learn a new work skill'],
  learning: ['Hold a Spanish conversation', 'Read 12 books this year', 'Finish an online course'],
  finance: ['Save 3 months of runway', 'Stick to a monthly budget', 'Start investing'],
  relationships: ['Call family weekly', 'Plan a monthly meetup', 'Be more present at home'],
  growth: ['Meditate daily', 'Journal every morning', 'Build one new habit'],
  _default: ['Run a 5K', 'Learn Spanish', 'Build a savings habit'],
}

const STAGES = [
  { n: 'Speck', c: '#9b8d7e', sz: 13, lvl: 0.1 },
  { n: 'Ember', c: '#fb7185', sz: 16, lvl: 0.32 },
  { n: 'Flare', c: '#ff6a3d', sz: 19, lvl: 0.55 },
  { n: 'Luminary', c: '#fbbf24', sz: 22, lvl: 0.74 },
  { n: 'Nova', c: '#f6b73c', sz: 26, lvl: 0.9 },
  { n: 'Celestial', c: '#818cf8', sz: 30, lvl: 1 },
]

const HOW_STEPS: Array<{ ic: string; title: string; body: string; glyph: ReactNode }> = [
  {
    ic: 'var(--accent)',
    title: 'Solly builds your SMART plan',
    body: 'Describe any goal in plain language. It becomes a structured, time-bound plan with clear milestones.',
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M16.3 7.7l2.1-2.1" />
        <path d="M9 17a5 5 0 1 1 6 0 3 3 0 0 0-1 2v1H10v-1a3 3 0 0 0-1-2z" />
      </svg>
    ),
  },
  {
    ic: 'var(--indigo)',
    title: 'Daily tasks keep you on track',
    body: 'Each day you get focused, bite-sized tasks. No overwhelm — just the next right step.',
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M3 9h18M8 2v4M16 2v4" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    ic: 'var(--gold)',
    title: 'Earn stars, evolve your creature',
    body: 'Every finished task earns star points — grow Solly from a tiny Speck all the way to Celestial.',
    glyph: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.9 6.2 20.3l1.6-6.6L2.6 8.8l6.8-.5z" />
      </svg>
    ),
  },
]

const FACE_BY_STEP = ['wink', 'sussy', 'sunglasses', 'kiss', 'wink']
const THINK_MESSAGES = ['Solly is shaping your goal…', 'Breaking it into milestones…', 'Scheduling your daily steps…']

function StarIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.9 6.2 20.3l1.6-6.6L2.6 8.8l6.8-.5z" />
    </svg>
  )
}

function ArrowRightIcon({ size = 17, strokeWidth = 2.4 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  )
}

// One-time (not per-render) star-field descriptor generation — lazy useState
// initializer, matching the app's existing Math.random()-at-mount pattern
// (see ChatPage.tsx's THINK_VARIANTS pick) rather than computing in render body.
function makeStars() {
  return Array.from({ length: 46 }, () => ({
    left: (Math.random() * 100).toFixed(2),
    top: (Math.random() * 100).toFixed(2),
    delay: (Math.random() * 3).toFixed(2),
    scale: (0.6 + Math.random() * 1.6).toFixed(2),
  }))
}

export default function OnboardingPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [chosenFocus, setChosenFocus] = useState<FocusId | null>(null)
  const [goalText, setGoalText] = useState('')
  const [goalFocused, setGoalFocused] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [thinkIdx, setThinkIdx] = useState(0)
  const [finishGoal, setFinishGoal] = useState({ title: '', focus: null as FocusId | null })

  const [stars] = useState(() => makeStars())
  const [reduceMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)

  const cardRef = useRef<HTMLDivElement>(null)
  const goalInputRef = useRef<HTMLTextAreaElement>(null)
  // Thinking-sequence + confetti timer ids — cleared on unmount so a user
  // navigating away mid-sequence doesn't get setState/rAF on a dead component
  // (same discipline as the shooting-star effect's cleanup below).
  const thinkIvRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const thinkToRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confettiRafRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (thinkIvRef.current !== null) clearInterval(thinkIvRef.current)
    if (thinkToRef.current !== null) clearTimeout(thinkToRef.current)
    if (confettiRafRef.current !== null) cancelAnimationFrame(confettiRafRef.current)
  }, [])
  const starsWrapRef = useRef<HTMLDivElement>(null)
  const confettiRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => { document.title = 'Welcome — GoalForge' }, [])

  // Reset card scroll on step change (prototype: `card.scrollTop = 0`).
  useEffect(() => { if (cardRef.current) cardRef.current.scrollTop = 0 }, [step])

  // Occasional slow shooting stars — ported verbatim (DOM append + Web
  // Animations API), skipped under prefers-reduced-motion.
  useEffect(() => {
    if (reduceMotion) return
    let timer: ReturnType<typeof setTimeout>
    function shoot() {
      const wrap = starsWrapRef.current
      if (!wrap) return
      const el = document.createElement('div')
      el.className = 'shoot'
      const startX = innerWidth * (0.05 + Math.random() * 0.55)
      const startY = innerHeight * (Math.random() * 0.35)
      const angle = (18 + Math.random() * 22) * Math.PI / 180
      const dist = innerWidth * 0.55 + Math.random() * innerWidth * 0.4
      el.style.left = startX + 'px'
      el.style.top = startY + 'px'
      wrap.appendChild(el)
      const dur = 2800 + Math.random() * 2200
      const a = angle * 180 / Math.PI
      el.animate([
        { transform: 'rotate(' + a + 'deg) translateX(0)', opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.82 },
        { transform: 'rotate(' + a + 'deg) translateX(' + dist + 'px)', opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(.45,0,.7,1)' }).onfinish = () => el.remove()
    }
    function loop() { shoot(); timer = setTimeout(loop, 5500 + Math.random() * 8000) }
    timer = setTimeout(loop, 2200 + Math.random() * 2500)
    return () => clearTimeout(timer)
  }, [reduceMotion])

  function burstConfetti() {
    if (reduceMotion) return
    const cv = confettiRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    cv.width = innerWidth
    cv.height = innerHeight
    const cols = ['#ff6a3d', '#ff9a4d', '#fbbf24', '#818cf8', '#34d399', '#fb7185']
    const cx = innerWidth / 2
    const cy = innerHeight * 0.42
    const parts = Array.from({ length: 120 }, (_, i) => {
      const a = Math.random() * Math.PI * 2
      const sp = 3 + Math.random() * 9
      return {
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
        g: 0.22 + Math.random() * 0.12, r: 3 + Math.random() * 4,
        c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1,
      }
    })
    let t0 = performance.now()
    function frame(t: number) {
      const dt = Math.min(32, t - t0) / 16
      t0 = t
      ctx!.clearRect(0, 0, cv!.width, cv!.height)
      let alive = false
      parts.forEach(p => {
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= 0.012 * dt
        if (p.life > 0) {
          alive = true
          ctx!.save(); ctx!.globalAlpha = Math.max(0, p.life); ctx!.translate(p.x, p.y); ctx!.rotate(p.rot)
          ctx!.fillStyle = p.c; ctx!.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); ctx!.restore()
        }
      })
      if (alive) { confettiRafRef.current = requestAnimationFrame(frame) } else { confettiRafRef.current = null; ctx!.clearRect(0, 0, cv!.width, cv!.height) }
    }
    confettiRafRef.current = requestAnimationFrame(frame)
  }

  function goTo(n: number) { setStep(Math.max(0, Math.min(n, 4))) }

  function createGoal() {
    if (thinking) return
    if (!goalText.trim()) return
    setThinking(true)
    setThinkIdx(0)
    thinkIvRef.current = setInterval(() => setThinkIdx(i => Math.min(i + 1, THINK_MESSAGES.length - 1)), 620)
    thinkToRef.current = setTimeout(() => {
      if (thinkIvRef.current !== null) clearInterval(thinkIvRef.current)
      thinkIvRef.current = null
      thinkToRef.current = null
      setThinking(false)
      setFinishGoal({ title: goalText.trim(), focus: chosenFocus })
      goTo(4)
      burstConfetti()
    }, 1900)
  }

  function skip() {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
    navigate('/dashboard', { replace: true })
  }

  function enterGoalForge() {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
    navigate(`/dashboard?goal=${encodeURIComponent(finishGoal.title)}`, { replace: true })
  }

  const focusMeta = chosenFocus ? FOCUS.find(f => f.id === chosenFocus) : null
  const finishFocusMeta = finishGoal.focus ? FOCUS.find(f => f.id === finishGoal.focus) : null
  const goalSub = focusMeta
    ? `A ${focusMeta.name.toLowerCase()} goal for the next 90 days — the one that really matters.`
    : 'What do you want to achieve in the next 90 days?'
  const chipList = (chosenFocus ? CHIPS[chosenFocus] : CHIPS._default)

  return (
    <div className="onb-root">
      <div className="stars" ref={starsWrapRef} aria-hidden="true">
        {stars.map((s, i) => (
          <i key={i} style={{ left: s.left + '%', top: s.top + '%', animationDelay: '-' + s.delay + 's', transform: 'scale(' + s.scale + ')' }} />
        ))}
      </div>

      <div className="shell">
        <div className="brand">Goal<span>Forge</span></div>

        <div className="stepper" role="progressbar" aria-label="Onboarding progress">
          <div className="steps">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={['step-dot', i < step && 'done', i === Math.min(step, TOTAL_STEPS - 1) && 'active'].filter(Boolean).join(' ')} />
            ))}
          </div>
          <div className="step-count">{step >= TOTAL_STEPS ? 'Done' : `${step + 1} of ${TOTAL_STEPS}`}</div>
        </div>

        <div className="stage">
          <div className="card" id="card" ref={cardRef}>

            <div className="solly" aria-hidden="true">
              <div className="solly-glow" />
              <div className="solly-float">
                <img className={FACE_BY_STEP[step] === 'wink' ? 'on' : ''} src="/solly/solly-wink.svg" alt="" />
                <img className={FACE_BY_STEP[step] === 'sussy' ? 'on' : ''} src="/solly/solly-sussy.svg" alt="" />
                <img className={FACE_BY_STEP[step] === 'sunglasses' ? 'on' : ''} src="/solly/solly-sunglasses.svg" alt="" />
                <img className={FACE_BY_STEP[step] === 'kiss' ? 'on' : ''} src="/solly/solly-kiss.svg" alt="" />
              </div>
            </div>

            {/* STEP 1: WELCOME */}
            <section className={['panel', step === 0 && 'show'].filter(Boolean).join(' ')}>
              <div className="eyebrow">Hi, I&apos;m Solly · your goal buddy</div>
              <h1 className="title">Welcome to Goal<span>Forge</span></h1>
              <p className="sub">Tell me what you&apos;re chasing and I&apos;ll turn it into a structured, AI-powered plan — daily tasks, milestones, and a star creature that grows brighter as you do.</p>
              <div className="welcome-pills">
                <span className="wpill">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="3" /></svg>
                  ~60 second setup
                </span>
                <span className="wpill">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6 9 17l-5-5" /></svg>
                  Free to start
                </span>
                <span className="wpill">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /></svg>
                  Gentle nudges, never nags
                </span>
              </div>
            </section>

            {/* STEP 2: FOCUS AREA */}
            <section className={['panel', step === 1 && 'show'].filter(Boolean).join(' ')}>
              <div className="eyebrow">Where should we start?</div>
              <h1 className="title">Pick your focus area</h1>
              <p className="sub">What part of your life do you want to level up first? You can add more later.</p>
              <div className="focus-grid">
                {FOCUS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={['focus-card', chosenFocus === f.id && 'sel'].filter(Boolean).join(' ')}
                    style={{ '--cc': f.cc } as React.CSSProperties}
                    onClick={() => setChosenFocus(f.id)}
                    aria-pressed={chosenFocus === f.id}
                  >
                    <span className="fc-ic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{f.icon()}</svg>
                    </span>
                    <span>
                      <span className="fc-name">{f.name}</span>
                      <span className="fc-desc">{f.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* STEP 3: HOW IT WORKS */}
            <section className={['panel', step === 2 && 'show'].filter(Boolean).join(' ')}>
              <div className="eyebrow">The simple part</div>
              <h1 className="title">Here&apos;s how it works</h1>
              <p className="sub">Three steps stand between you and your goal.</p>
              <div className="how-list">
                {HOW_STEPS.map((s, i) => (
                  <div key={i} className="how-row">
                    <div className="how-ic" style={{ '--ic': s.ic } as React.CSSProperties}>{s.glyph}</div>
                    <div>
                      <div className="how-h">{s.title}</div>
                      <div className="how-p">{s.body}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="stage-strip">
                <div className="stage-strip-cap">Your brightness journey</div>
                <div className="stage-row">
                  {STAGES.map((s, i) => (
                    <div key={s.n} style={{ display: 'contents' }}>
                      <div className="stg" style={{ '--sc': s.c, '--lvl': s.lvl } as React.CSSProperties}>
                        <span style={{ width: s.sz, height: s.sz, display: 'grid' }}><StarIcon size={s.sz} /></span>
                        <span className="stg-name">{s.n}</span>
                      </div>
                      {i < STAGES.length - 1 && (
                        <svg className="stg-arrow" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* STEP 4: SET GOAL */}
            <section className={['panel', step === 3 && 'show'].filter(Boolean).join(' ')}>
              <div className="eyebrow">The fun part</div>
              <h1 className="title">Set your first goal</h1>
              <p className="sub">{goalSub}</p>
              <div className="goal-wrap" style={{ display: thinking ? 'none' : undefined }}>
                <div className={['goal-pillwrap', goalFocused && 'focus'].filter(Boolean).join(' ')}>
                  <div className="goal-field">
                    <span className="goal-star"><StarIcon /></span>
                    <textarea
                      ref={goalInputRef}
                      className="goal-input"
                      rows={2}
                      value={goalText}
                      onChange={e => setGoalText(e.target.value)}
                      onFocus={() => setGoalFocused(true)}
                      onBlur={() => setGoalFocused(false)}
                      onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (goalText.trim()) createGoal() } }}
                      placeholder="e.g. Run a 5K by the end of June, learn the basics of Spanish, build a consistent savings habit…"
                    />
                  </div>
                </div>
                <div className="goal-chips">
                  {/* prototype: chip click fills the input AND refocuses it */}
                  {chipList.map(t => (
                    <button key={t} type="button" className="gchip" onClick={() => { setGoalText(t); goalInputRef.current?.focus() }}>{t}</button>
                  ))}
                </div>
                <div className="goal-tip">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                  Don&apos;t worry about being perfect — Solly will shape it into a SMART goal.
                </div>
              </div>
              <div className={['thinking', thinking && 'show'].filter(Boolean).join(' ')}>
                <div className="think-dots"><i /><i /><i /></div>
                <div className="think-t">{THINK_MESSAGES[thinkIdx]}</div>
              </div>
            </section>

            {/* STEP 5: FINISH */}
            <section className={['panel', step === 4 && 'show'].filter(Boolean).join(' ')}>
              <div className="eyebrow">You&apos;re all set</div>
              <h1 className="title">Let&apos;s forge it. ✨</h1>
              <p className="sub">Your plan is ready and Solly&apos;s warmed up. Time to take the first small step.</p>
              <div className="finish-goal" style={finishFocusMeta ? ({ '--cc': finishFocusMeta.cc } as React.CSSProperties) : undefined}>
                <div className="fg-cap"><StarIcon size={12} />Your first goal</div>
                <div className="fg-title">{finishGoal.title || (finishFocusMeta ? `Make progress on ${finishFocusMeta.name.toLowerCase()}` : 'Build a better daily habit')}</div>
                <div className="fg-meta">
                  {finishFocusMeta && <span className="fg-tag cc">{finishFocusMeta.name}</span>}
                  <span className="fg-tag">90-day goal</span>
                  <span className="fg-tag">Daily tasks</span>
                  <span className="fg-tag">Stage · Speck</span>
                </div>
              </div>
            </section>

            {/* NAV */}
            <div className={['nav', step === 4 && 'center'].filter(Boolean).join(' ')}>
              {step === 0 && (
                <>
                  <button type="button" className="btn-primary" onClick={() => goTo(1)}>Get Started <ArrowRightIcon /></button>
                  <button type="button" className="btn-skip" onClick={skip}>Skip for now</button>
                </>
              )}
              {step === 1 && (
                <>
                  <button type="button" className="btn-back" onClick={() => goTo(0)}><ArrowLeftIcon />Back</button>
                  <button type="button" className={['btn-primary', !chosenFocus && 'disabled'].filter(Boolean).join(' ')} onClick={() => chosenFocus && goTo(2)}>Next <ArrowRightIcon /></button>
                  <button type="button" className="btn-skip" onClick={skip}>Skip for now</button>
                </>
              )}
              {step === 2 && (
                <>
                  <button type="button" className="btn-back" onClick={() => goTo(1)}><ArrowLeftIcon />Back</button>
                  <button type="button" className="btn-primary" onClick={() => goTo(3)}>Next <ArrowRightIcon /></button>
                  <button type="button" className="btn-skip" onClick={skip}>Skip for now</button>
                </>
              )}
              {step === 3 && (
                <>
                  <button type="button" className="btn-back" onClick={() => goTo(2)}><ArrowLeftIcon />Back</button>
                  <button type="button" className={['btn-primary', !goalText.trim() && 'disabled'].filter(Boolean).join(' ')} onClick={() => goalText.trim() && createGoal()}>Create My Goal <ArrowRightIcon /></button>
                  <button type="button" className="btn-skip" onClick={skip}>Skip for now</button>
                </>
              )}
              {step === 4 && (
                <button type="button" className="btn-primary" onClick={enterGoalForge}>Enter GoalForge <ArrowRightIcon /></button>
              )}
            </div>

          </div>
        </div>
      </div>

      <canvas id="confetti" ref={confettiRef} />
    </div>
  )
}
