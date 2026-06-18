import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Show } from '@clerk/react'

const STEPS = [
  { n: '01', title: 'Describe your goal', desc: 'Tell us what you want to achieve in plain language — no frameworks needed.' },
  { n: '02', title: 'AI builds your plan', desc: 'Gemini converts your input into a SMART goal with milestones and a 7-day sprint.' },
  { n: '03', title: 'Complete tasks, earn stars', desc: 'Finish daily tasks to earn ⭐ star points and evolve your companion.' },
]

const FEATURES = [
  { icon: '🎯', title: 'Smart Goals', desc: 'AI refines your raw idea into a SMART goal with clear milestones and success criteria.' },
  { icon: '✦', title: 'Star Companion', desc: 'A gamified buddy that evolves across 6 stages as you hit milestones.' },
  { icon: '⚡', title: 'Daily Sprints', desc: 'Auto-generated 7-day task plans keep you moving forward every single day.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 30) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { document.title = 'GoalForge — Forge your goals, level up your life' }, [])

  return (
    <div className="lp-root" ref={navRef as React.RefObject<HTMLDivElement>}>

      {/* Nav */}
      <nav className={['lp-nav', scrolled && 'scrolled'].filter(Boolean).join(' ')}>
        <div className="lp-container lp-nav-in">
          <div className="lp-logo">Goal<span>Forge</span></div>
          <div className="lp-nav-right">
            <Show when="signed-out">
              <button onClick={() => navigate('/sign-in')} className="lp-btn lp-btn-ghost">Sign in</button>
              <button onClick={() => navigate('/sign-up')} className="lp-btn lp-btn-primary">Get started</button>
            </Show>
            <Show when="signed-in">
              <button onClick={() => navigate('/dashboard')} className="lp-btn lp-btn-primary">Dashboard →</button>
            </Show>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="lp-hero lp-container">
        <div className="lp-badge">✦ AI-POWERED GOAL COMPANION</div>
        <h1 className="lp-hero-h1">
          Forge your goals,{' '}
          <span>level up your life</span>
        </h1>
        <p className="lp-hero-sub">
          GoalForge turns your ambitions into structured sprints — with an AI companion that keeps you accountable and motivated every day.
        </p>
        <div className="lp-hero-ctas">
          <Show when="signed-out">
            <button onClick={() => navigate('/sign-up')} className="lp-btn lp-btn-primary lp-btn-lg">Start for free</button>
            <button onClick={() => navigate('/sign-in')} className="lp-btn lp-btn-ghost lp-btn-lg">Sign in</button>
          </Show>
          <Show when="signed-in">
            <button onClick={() => navigate('/dashboard')} className="lp-btn lp-btn-primary lp-btn-lg">Open Dashboard →</button>
          </Show>
        </div>
        <p className="lp-proof">NO CREDIT CARD · FREE TO START · EVOLVE YOUR STAR</p>
      </section>

      {/* How It Works */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <div className="lp-eyebrow" style={{ color: 'var(--lp-gold)' }}>HOW IT WORKS</div>
            <h2 className="lp-section-h2">Three steps to momentum</h2>
          </div>
          <div className="lp-grid-3">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="lp-card">
                <div className="lp-card-num">{n}</div>
                <div className="lp-card-title">{title}</div>
                <div className="lp-card-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <div className="lp-eyebrow" style={{ color: 'var(--lp-indigo)' }}>FEATURES</div>
            <h2 className="lp-section-h2">Everything you need to follow through</h2>
          </div>
          <div className="lp-grid-3">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="lp-card">
                <div className="lp-card-icon">{icon}</div>
                <div className="lp-card-title">{title}</div>
                <div className="lp-card-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <div className="lp-eyebrow" style={{ color: 'var(--lp-gold)' }}>START TODAY</div>
        <h2 className="lp-cta-h2">Your goals won&apos;t forge themselves.</h2>
        <p className="lp-cta-sub">Join GoalForge and turn every ambition into a structured, achievable plan — starting now.</p>
        <Show when="signed-out">
          <button onClick={() => navigate('/sign-up')} className="lp-btn lp-btn-primary lp-btn-lg">Create your free account</button>
        </Show>
        <Show when="signed-in">
          <button onClick={() => navigate('/dashboard')} className="lp-btn lp-btn-primary lp-btn-lg">Go to Dashboard</button>
        </Show>
        <p className="lp-proof">NO CREDIT CARD REQUIRED</p>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        © 2026 Goal<span>Forge</span> — Built with AI
      </footer>
    </div>
  )
}
