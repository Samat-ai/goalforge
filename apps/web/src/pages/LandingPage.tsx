import { useNavigate } from 'react-router-dom'
import { Show } from '@clerk/react'
import { Target, Sparkles, Zap, ChevronRight } from 'lucide-react'

const T = {
  bg: "#07070f", surface: "#0e0e1a", card: "#12121f", border: "#1c1c30",
  orange: "#f97316", indigo: "#818cf8", amber: "#fbbf24",
  text: "#e8e8f0", muted: "#71717a", dim: "#3f3f5c",
  serif: "'Plus Jakarta Sans', sans-serif", mono: "'JetBrains Mono', monospace",
}

const Btn = ({ children, onClick, primary = false }: { children: React.ReactNode, onClick: () => void, primary?: boolean }) => (
  <button
    onClick={onClick}
    style={{
      fontFamily: T.serif, fontSize: 15, fontWeight: 600, cursor: "pointer",
      padding: "12px 28px", borderRadius: 10, transition: "opacity 0.15s",
      background: primary ? T.orange : "transparent",
      color: primary ? "#fff" : T.muted,
      border: primary ? "none" : `1px solid ${T.border}`,
    }}
    onMouseEnter={e => (e.currentTarget.style.opacity = "0.82")}
    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
  >
    {children}
  </button>
)

const steps = [
  { n: "01", title: "Describe Your Goal", desc: "Tell us what you want to achieve in plain language — no frameworks needed." },
  { n: "02", title: "AI Builds Your Plan", desc: "Gemini converts your input into a SMART goal with milestones and a 7-day sprint." },
  { n: "03", title: "Complete & Earn Stars", desc: "Finish daily tasks to earn ⭐ star points and evolve your companion." },
]

const features = [
  { icon: <Target size={20} />, title: "Smart Goals", desc: "AI refines your raw idea into a SMART goal with clear milestones and success criteria." },
  { icon: <Sparkles size={20} />, title: "Star Companion", desc: "A gamified AI buddy that evolves across 6 stages as you hit milestones." },
  { icon: <Zap size={20} />, title: "Daily Sprints", desc: "Auto-generated 7-day task plans keep you moving forward every single day." },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh mesh-bg text-white flex flex-col" style={{ fontFamily: T.serif, background: T.bg }}>

      {/* ── Nav ── */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, background: `${T.bg}f0`, backdropFilter: "blur(10px)" }}
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10"
        role="banner"
      >
        <div style={{ height: 54, display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 700, color: T.text, letterSpacing: "-0.3px" }}>
            Goal<span style={{ color: T.orange }}>Forge</span>
          </span>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Show when="signed-out">
            <Btn onClick={() => navigate('/sign-in')}>Sign In</Btn>
            <Btn onClick={() => navigate('/sign-up')} primary>Get Started</Btn>
          </Show>
          <Show when="signed-in">
            <Btn onClick={() => navigate('/dashboard')} primary>Dashboard</Btn>
          </Show>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center px-6 sm:px-10 pt-20 pb-16 sm:pt-28 sm:pb-24 gap-7">
        {/* badge */}
        <div style={{
          fontFamily: T.mono, fontSize: 10, letterSpacing: "0.14em",
          color: T.indigo, background: `${T.indigo}14`, border: `1px solid ${T.indigo}30`,
          borderRadius: 99, padding: "5px 14px",
        }}>
          ✦ AI-POWERED GOAL COMPANION
        </div>

        <h1 className="text-[38px] sm:text-[58px] lg:text-[72px] leading-[1.08] font-extrabold tracking-tight max-w-3xl" style={{ fontFamily: T.serif }}>
          Forge your goals,{" "}
          <span style={{ color: T.amber }}>level up your life</span>
        </h1>

        <p className="text-base sm:text-lg max-w-xl" style={{ color: T.muted, lineHeight: 1.7 }}>
          GoalForge turns your ambitions into structured sprints — with an AI companion
          that keeps you accountable and motivated every day.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Show when="signed-out">
            <Btn onClick={() => navigate('/sign-up')} primary>Start for free</Btn>
            <Btn onClick={() => navigate('/sign-in')}>Sign In</Btn>
          </Show>
          <Show when="signed-in">
            <Btn onClick={() => navigate('/dashboard')} primary>Open Dashboard <ChevronRight size={15} style={{ display: "inline", verticalAlign: "middle", marginLeft: 2 }} /></Btn>
          </Show>
        </div>

        {/* social proof */}
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, letterSpacing: "0.06em", marginTop: 4 }}>
          NO CREDIT CARD · FREE TO START · EVOLVE YOUR STAR
        </p>
      </section>

      {/* ── How It Works ── */}
      <section className="px-6 sm:px-10 pb-20 sm:pb-28 flex flex-col items-center gap-10">
        <div className="text-center">
          <p style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.14em", color: T.amber, marginBottom: 10 }}>HOW IT WORKS</p>
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: T.serif, color: T.text }}>Three steps to momentum</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 w-full max-w-4xl">
          {steps.map(({ n, title, desc }) => (
            <div key={n} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "28px 24px" }}>
              <span style={{ fontFamily: T.mono, fontSize: 36, fontWeight: 700, color: T.dim, display: "block", marginBottom: 14 }}>{n}</span>
              <p style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>{title}</p>
              <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 sm:px-10 pb-20 sm:pb-28 flex flex-col items-center gap-10">
        <div className="text-center">
          <p style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.14em", color: T.indigo, marginBottom: 10 }}>FEATURES</p>
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: T.serif, color: T.text }}>Everything you need to follow through</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 w-full max-w-4xl">
          {features.map(({ icon, title, desc }) => (
            <div key={title} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px" }}>
              <div style={{ color: T.orange, marginBottom: 14 }}>{icon}</div>
              <p style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>{title}</p>
              <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ borderTop: `1px solid ${T.border}` }}
        className="flex flex-col items-center text-center px-6 sm:px-10 py-20 sm:py-28 gap-6"
      >
        <p style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.14em", color: T.amber }}>START TODAY</p>
        <h2 className="text-2xl sm:text-4xl font-extrabold max-w-xl" style={{ fontFamily: T.serif, color: T.text, lineHeight: 1.2 }}>
          Your goals won't forge themselves.
        </h2>
        <p style={{ fontSize: 15, color: T.muted, maxWidth: 400, lineHeight: 1.7 }}>
          Join GoalForge and turn every ambition into a structured, achievable plan — starting now.
        </p>
        <Show when="signed-out">
          <Btn onClick={() => navigate('/sign-up')} primary>Create your free account</Btn>
        </Show>
        <Show when="signed-in">
          <Btn onClick={() => navigate('/dashboard')} primary>Go to Dashboard</Btn>
        </Show>
        <p style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: "0.08em" }}>NO CREDIT CARD REQUIRED</p>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: "18px 24px" }}
        className="flex items-center justify-center"
      >
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>
          © 2026 Goal<span style={{ color: T.orange }}>Forge</span> — Built with AI
        </span>
      </footer>
    </div>
  )
}
