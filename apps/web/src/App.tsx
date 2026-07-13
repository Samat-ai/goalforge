import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Show } from '@clerk/react'
import { Toaster } from 'sonner'
import AppShell from './components/gf/AppShell'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import FaqPage from './pages/FaqPage'
import DashboardPage from './pages/DashboardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ChatPage from './pages/ChatPage'
import LogsPage from './pages/LogsPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import SettingsPage from './pages/SettingsPage'
import OnboardingPage from './pages/OnboardingPage'
import OnboardingGuard from './components/OnboardingGuard'
import ErrorBoundary from './components/ErrorBoundary'
import EnergyParamCapture from './components/EnergyParamCapture'
import OfflineBanner from './components/OfflineBanner'

// ⚠️ E2E_MODE bypasses auth — never set VITE_E2E_MODE=true in production
const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
if (isE2EMode) {
  console.error('[GoalForge] E2E_MODE is active — Clerk auth is bypassed. This must never run in production!')
}

function useToasterPosition(): 'bottom-right' | 'top-center' {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile ? 'top-center' : 'bottom-right'
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  if (isE2EMode) return <>{children}</>

  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <EnergyParamCapture />
      <Toaster theme="dark" position={useToasterPosition()} richColors />
      <OfflineBanner />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          {/* Onboarding — authenticated but intentionally before OnboardingGuard */}
          <Route
            path="/onboarding"
            element={
              <AuthGuard>
                <OnboardingPage />
              </AuthGuard>
            }
          />
          {/* Authenticated + onboarding-complete routes — persistent AppShell owns the header/nav */}
          <Route element={<AuthGuard><OnboardingGuard><AppShell /></OnboardingGuard></AuthGuard>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/stars"     element={<LogsPage />} />
            <Route path="/chat"      element={<ChatPage />} />
            {/* legacy path — the coach became plain "Chat" in the nav; keep old links alive */}
            <Route path="/coach"     element={<Navigate to="/chat" replace />} />
            <Route path="/settings"  element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<div className="p-8 text-center">404 - Page Not Found</div>} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
