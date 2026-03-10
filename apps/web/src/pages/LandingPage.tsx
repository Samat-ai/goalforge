import { useNavigate } from 'react-router-dom'
import { Show } from '@clerk/react'
import { Target, Sparkles, TrendingUp } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2 text-xl font-bold">
          <Target className="text-violet-400" size={26} />
          <span>GoalForge</span>
        </div>
        <div className="flex gap-3">
          <Show when="signed-out">
            <button
              onClick={() => navigate('/sign-in')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-violet-300 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/sign-up')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 transition-colors"
            >
              Get Started
            </button>
          </Show>
          <Show when="signed-in">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 transition-colors"
            >
              Go to Dashboard
            </button>
          </Show>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-8">
        <div className="flex items-center gap-2 bg-violet-900/40 border border-violet-700/40 rounded-full px-4 py-1.5 text-sm text-violet-300">
          <Sparkles size={14} />
          AI-powered goal companion
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-3xl leading-tight">
          Forge your goals,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">
            level up your life
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-xl">
          GoalForge transforms your ambitions into smart, structured goals —
          with an AI companion that keeps you motivated every day.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Show when="signed-out">
            <button
              onClick={() => navigate('/sign-up')}
              className="px-8 py-3 rounded-xl font-semibold bg-violet-600 hover:bg-violet-500 transition-colors text-lg"
            >
              Start for free
            </button>
            <button
              onClick={() => navigate('/sign-in')}
              className="px-8 py-3 rounded-xl font-semibold border border-slate-600 hover:border-violet-500 transition-colors text-lg text-slate-300 hover:text-white"
            >
              Sign In
            </button>
          </Show>
          <Show when="signed-in">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-8 py-3 rounded-xl font-semibold bg-violet-600 hover:bg-violet-500 transition-colors text-lg"
            >
              Open Dashboard
            </button>
          </Show>
        </div>

        {/* Features row */}
        <div className="grid sm:grid-cols-3 gap-6 mt-12 max-w-3xl w-full">
          {[
            { icon: <Target size={22} />, title: 'Smart Goals', desc: 'AI refines your input into SMART structured goals.' },
            { icon: <Sparkles size={22} />, title: 'Star Companion', desc: 'A gamified AI buddy that evolves with your progress.' },
            { icon: <TrendingUp size={22} />, title: 'Daily Tasks', desc: 'Auto-generated tasks keep you moving forward daily.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left gap-3 flex flex-col">
              <div className="text-violet-400">{icon}</div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
