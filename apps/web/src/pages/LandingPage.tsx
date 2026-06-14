import { useNavigate } from 'react-router-dom'
import { Show } from '@clerk/react'
import {
  Target, Zap, Users, Star, CheckCircle, ArrowRight,
  Brain, Battery, UserCheck, ChevronRight,
} from 'lucide-react'

// ── Creature stage data ───────────────────────────────────────────────────────
const STAGES = [
  { name: "Speck",     pts: 0,   color: "#4a4a6a", glow: "#4a4a6a" },
  { name: "Ember",     pts: 30,  color: "#c2410c", glow: "#f97316" },
  { name: "Flare",     pts: 80,  color: "#f97316", glow: "#fb923c" },
  { name: "Luminary",  pts: 175, color: "#fbbf24", glow: "#fde68a" },
  { name: "Nova",      pts: 350, color: "#bae6fd", glow: "#7dd3fc" },
  { name: "Celestial", pts: 600, color: "#a5f3fc", glow: "#cffafe" },
]

// Minimal static SVG star creature for each stage
function MiniCreature({ stage, size = 56 }: { stage: typeof STAGES[number]; size?: number }) {
  const cx = size / 2, cy = size / 2
  const outerR = size * 0.38
  const innerR = size * 0.15
  const nPoints = stage.pts >= 350 ? 8 : stage.pts >= 80 ? 6 : 5
  const verts: [number, number][] = []
  for (let i = 0; i < nPoints * 2; i++) {
    const angle = (i * Math.PI) / nPoints - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    verts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  const path = verts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z'

  const eyeY = cy - outerR * 0.18
  const eyeOff = outerR * 0.28
  const hasEyes = stage.pts >= 30
  const hasSmile = stage.pts >= 80
  const hasCrown = stage.pts >= 350

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`mc_glow_${stage.pts}`}>
          <stop offset="0%" stopColor={stage.glow} stopOpacity="0.4" />
          <stop offset="100%" stopColor={stage.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`mc_body_${stage.pts}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor={stage.color} stopOpacity="1" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={outerR * 1.8} ry={outerR * 1.8}
        fill={`url(#mc_glow_${stage.pts})`} />
      <path d={path} fill={`url(#mc_body_${stage.pts})`}
        stroke={stage.color} strokeWidth="0.5" />
      {hasEyes && <>
        <ellipse cx={cx - eyeOff} cy={eyeY} rx={3.5} ry={4} fill="white" opacity="0.9" />
        <ellipse cx={cx + eyeOff} cy={eyeY} rx={3.5} ry={4} fill="white" opacity="0.9" />
        <circle cx={cx - eyeOff + 0.8} cy={eyeY} r={1.8} fill="#07070f" opacity="0.85" />
        <circle cx={cx + eyeOff + 0.8} cy={eyeY} r={1.8} fill="#07070f" opacity="0.85" />
      </>}
      {hasSmile && (() => {
        const sy = cy + outerR * 0.3
        const sw = outerR * 0.38
        return <path d={`M ${cx - sw} ${sy} Q ${cx} ${sy + 5} ${cx + sw} ${sy}`}
          fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
      })()}
      {hasCrown && (() => {
        const ky = cy - outerR * 1.05
        const kw = outerR * 0.5
        return <g opacity="0.9">
          <path d={`M ${cx - kw} ${ky + 7} L ${cx - kw} ${ky} L ${cx - kw * 0.35} ${ky + 5} L ${cx} ${ky - 2} L ${cx + kw * 0.35} ${ky + 5} L ${cx + kw} ${ky} L ${cx + kw} ${ky + 7} Z`}
            fill={stage.pts >= 600 ? "#fbbf24" : "#f97316"} stroke="#fef3c7" strokeWidth="0.5" />
          <circle cx={cx} cy={ky - 2} r={2.5} fill="#fef9c3" />
        </g>
      })()}
    </svg>
  )
}

// ── Star Rating ───────────────────────────────────────────────────────────────
function StarRating({ count = 5 }: { count?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} className="fill-orange-400 text-orange-400" />
      ))}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()

  const scrollToFeatures = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 h-14
                      border-b border-slate-800/70 bg-slate-950/90 backdrop-blur-md">
        <span className="text-xl font-bold tracking-tight">
          Goal<span className="text-orange-400">Forge</span>
        </span>
        <div className="flex gap-2 sm:gap-3 items-center">
          <Show when="signed-out">
            <button
              onClick={() => navigate('/sign-in')}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/sign-up')}
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </button>
          </Show>
          <Show when="signed-in">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              Dashboard <ChevronRight size={14} />
            </button>
          </Show>
        </div>
      </nav>

      {/* ── Section 1: Hero ── */}
      <section className="relative flex flex-col items-center text-center px-6 sm:px-10
                          pt-20 pb-20 sm:pt-28 sm:pb-28 overflow-hidden
                          bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
                        bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 text-xs font-mono tracking-widest
                        text-indigo-400 bg-indigo-500/10 border border-indigo-500/20
                        rounded-full px-4 py-1.5 uppercase">
          <span className="text-indigo-400">✦</span> AI-Powered Goal Companion
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] max-w-4xl mb-6">
          Turn Goals Into Daily Wins —{' '}
          <span className="text-orange-400">Powered by AI</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
          GoalForge transforms vague intentions into structured SMART plans with daily tasks.
          Complete tasks, earn stars, and watch your companion evolve.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-14">
          <Show when="signed-out">
            <button
              onClick={() => navigate('/sign-up')}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500
                         text-white font-semibold px-7 py-3.5 rounded-xl transition-colors text-sm"
            >
              Start for Free <ArrowRight size={16} />
            </button>
            <button
              onClick={scrollToFeatures}
              className="flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500
                         text-slate-300 hover:text-white font-semibold px-7 py-3.5 rounded-xl transition-colors text-sm"
            >
              See How It Works
            </button>
          </Show>
          <Show when="signed-in">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500
                         text-white font-semibold px-7 py-3.5 rounded-xl transition-colors text-sm"
            >
              Go to Dashboard <ArrowRight size={16} />
            </button>
          </Show>
        </div>

        {/* Evolution progression */}
        <div className="w-full max-w-3xl">
          <p className="text-xs font-mono tracking-widest text-slate-500 uppercase mb-6">
            Your Companion's Evolution Path
          </p>
          <div className="flex items-center justify-center gap-0 flex-wrap sm:flex-nowrap">
            {STAGES.map((stage, i) => (
              <div key={stage.name} className="flex items-center">
                <div className="flex flex-col items-center gap-2 px-2 sm:px-3">
                  <div className="relative">
                    <MiniCreature stage={stage} size={52} />
                  </div>
                  <span className="text-[10px] font-mono tracking-wide"
                    style={{ color: stage.color }}>
                    {stage.name}
                  </span>
                  <span className="text-[9px] text-slate-600 font-mono">
                    {stage.pts === 0 ? 'Start' : `${stage.pts}★`}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="flex items-center mb-6">
                    <div className="w-6 sm:w-8 h-px bg-gradient-to-r from-slate-700 to-slate-600" />
                    <ChevronRight size={12} className="text-slate-600 -ml-1" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 2: Social Proof Bar ── */}
      <section className="bg-slate-900 border-y border-slate-800 px-6 sm:px-10 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-center">
          <p className="text-slate-300 font-medium text-sm sm:text-base">
            Join <span className="text-white font-bold">1,000+</span> goal-setters already forging their future
          </p>
          <div className="h-px sm:h-6 w-full sm:w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <StarRating count={5} />
            <span className="text-slate-300 text-sm font-medium">
              <span className="text-orange-400 font-bold">4.9/5</span> from early users
            </span>
          </div>
          <div className="h-px sm:h-6 w-full sm:w-px bg-slate-700" />
          <p className="text-slate-500 text-xs font-mono tracking-widest uppercase">
            No credit card required
          </p>
        </div>
      </section>

      {/* ── Section 3: How It Works ── */}
      <section id="how-it-works" className="bg-slate-950 px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-mono tracking-widest text-orange-400 uppercase mb-3">
              How It Works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Three steps to momentum
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Tell GoalForge your goal',
                desc: 'Describe your ambition in plain language. Our AI runs a 5-question intake and converts it into a SMART goal with clear milestones and a structured plan.',
                icon: <Brain size={22} className="text-indigo-400" />,
              },
              {
                step: '02',
                title: 'Complete daily tasks',
                desc: 'Each day you get focused micro-tasks (~15–30 min) that move you forward. Low energy? Resize any task to a 3-minute first step.',
                icon: <CheckCircle size={22} className="text-indigo-400" />,
              },
              {
                step: '03',
                title: 'Evolve and grow',
                desc: 'Earn star points for every completed task. Watch your companion evolve through 6 stages — from Speck to Celestial — as your consistency compounds.',
                icon: <Zap size={22} className="text-indigo-400" />,
              },
            ].map(({ step, title, desc, icon }) => (
              <div key={step}
                className="relative bg-slate-900 border border-slate-800 rounded-2xl p-7
                           hover:border-indigo-500/40 transition-colors group">
                <span className="text-4xl font-extrabold text-slate-800 font-mono block mb-5
                                  group-hover:text-slate-700 transition-colors">
                  {step}
                </span>
                <div className="mb-4">{icon}</div>
                <h3 className="text-base font-semibold text-white mb-3">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Feature Highlights ── */}
      <section className="bg-slate-900 px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-mono tracking-widest text-indigo-400 uppercase mb-3">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything you need to follow through
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: <Target size={24} className="text-orange-400" />,
                title: 'AI Coaching',
                desc: 'A 5-question intake session creates a personalized goal plan tailored to your timeline, energy, and obstacles — no generic advice.',
              },
              {
                icon: <Battery size={24} className="text-orange-400" />,
                title: 'Energy Mode',
                desc: 'Having a low-energy day? One tap resizes any task to a 3-minute first step so you never break your streak, no matter how you feel.',
              },
              {
                icon: <Users size={24} className="text-orange-400" />,
                title: 'Accountability',
                desc: 'Invite a partner to keep each other on track. Share progress, celebrate wins, and get a nudge when either of you falls behind.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-7
                           hover:border-orange-500/30 transition-colors">
                <div className="mb-5 p-2.5 bg-orange-500/10 rounded-xl w-fit">{icon}</div>
                <h3 className="text-base font-semibold text-white mb-3">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Pricing ── */}
      <section id="pricing" className="bg-slate-950 px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-mono tracking-widest text-indigo-400 uppercase mb-3">
              Pricing
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-400 mt-3 text-sm">Start free. Upgrade when you're ready.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1">Free</h3>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-slate-500 text-sm pb-1">/month</span>
                </div>
                <p className="text-slate-400 text-sm">Perfect for getting started</p>
              </div>
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {[
                  '2 active goals',
                  '7-day analytics',
                  'Basic rewards',
                  'Companion evolution',
                  'Daily task plans',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle size={15} className="text-indigo-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/sign-up')}
                className="w-full text-sm font-semibold border border-slate-700 hover:border-slate-500
                           text-slate-300 hover:text-white py-3 rounded-xl transition-colors"
              >
                Get Started Free
              </button>
            </div>

            {/* Pro */}
            <div className="relative bg-indigo-950 border-2 border-indigo-500/60 rounded-2xl p-8 flex flex-col
                            shadow-lg shadow-indigo-500/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                  MOST POPULAR
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1">Pro</h3>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-4xl font-extrabold text-white">$9</span>
                  <span className="text-slate-400 text-sm pb-1">/month</span>
                </div>
                <p className="text-slate-400 text-sm">For serious goal-setters</p>
              </div>
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {[
                  'Unlimited active goals',
                  'AI coaching & intake',
                  'Energy resize mode',
                  'Full analytics dashboard',
                  'Accountability partners',
                  'Data export',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-200">
                    <CheckCircle size={15} className="text-indigo-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/sign-up')}
                className="w-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-500
                           text-white py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Get Pro <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Testimonials ── */}
      <section className="bg-slate-900 px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-mono tracking-widest text-orange-400 uppercase mb-3">
              Testimonials
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Real results from real forgers
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                name: 'Maya Chen',
                role: 'Freelance Designer',
                quote: 'I've tried every productivity app out there. GoalForge is the first one that actually made me follow through. My companion reaching Luminary felt like a real achievement.',
                stars: 5,
              },
              {
                name: 'James Okafor',
                role: 'Software Engineer',
                quote: 'The energy resize feature is a game-changer. On tough days I just do the 3-minute version, and I still keep my streak. Six months in and I've shipped two side projects.',
                stars: 5,
              },
              {
                name: 'Sarah Romero',
                role: 'Graduate Student',
                quote: 'Having an accountability partner inside the app keeps me honest. GoalForge helped me finish my thesis proposal ahead of schedule — something I never thought I could do.',
                stars: 5,
              },
            ].map(({ name, role, quote, stars }) => (
              <div key={name}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-7
                           hover:border-slate-700 transition-colors flex flex-col gap-4">
                <StarRating count={stars} />
                <p className="text-sm text-slate-300 leading-relaxed flex-1">"{quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-white">{name}</p>
                  <p className="text-xs text-slate-500">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7: CTA Banner ── */}
      <section className="relative bg-gradient-to-br from-indigo-950 to-slate-950 px-6 sm:px-10 py-20 sm:py-28
                          border-t border-slate-800 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[500px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl mx-auto flex flex-col items-center text-center gap-6">
          <p className="text-xs font-mono tracking-widest text-orange-400 uppercase">
            Start Today
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Ready to forge<br className="hidden sm:block" /> your goals?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-md leading-relaxed">
            Join thousands of goal-setters who turned vague intentions into daily wins.
            Your companion is waiting.
          </p>
          <Show when="signed-out">
            <button
              onClick={() => navigate('/sign-up')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white
                         font-semibold px-8 py-4 rounded-xl transition-colors text-sm mt-2"
            >
              Start Free Today <ArrowRight size={16} />
            </button>
          </Show>
          <Show when="signed-in">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white
                         font-semibold px-8 py-4 rounded-xl transition-colors text-sm mt-2"
            >
              Go to Dashboard <ArrowRight size={16} />
            </button>
          </Show>
          <p className="text-slate-600 text-xs font-mono tracking-widest uppercase">
            No credit card required
          </p>
        </div>
      </section>

      {/* ── Section 8: Footer ── */}
      <footer className="bg-slate-950 border-t border-slate-800 px-6 sm:px-10 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-base font-bold tracking-tight">
            Goal<span className="text-orange-400">Forge</span>
          </span>
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            <button
              onClick={scrollToFeatures}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={() => navigate('/sign-in')}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Sign In
            </button>
          </nav>
          <span className="text-xs text-slate-600 font-mono">© 2025 GoalForge</span>
        </div>
      </footer>
    </div>
  )
}
