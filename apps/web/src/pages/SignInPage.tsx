import { SignIn } from '@clerk/react'
import { Link } from 'react-router-dom'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'

export default function SignInPage() {
  if (isE2EMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-indigo-400/30 bg-slate-950/75 p-6 text-center text-slate-200 shadow-2xl">
          <h1 className="mb-2 text-2xl font-semibold">E2E Login</h1>
          <p className="mb-6 text-sm text-slate-400">
            Test mode auth is enabled for local Playwright runs.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-indigo-400/50 bg-indigo-500/20 px-5 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/30"
          >
            Continue to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </div>
  )
}
