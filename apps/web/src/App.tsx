import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Show } from '@clerk/react'
import { Toaster } from 'sonner'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Coach from './pages/Coach'
import Stars from './pages/Stars'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import Settings from './pages/Settings'
import ErrorBoundary from './components/ErrorBoundary'
import EnergyParamCapture from './components/EnergyParamCapture'
import OfflineBanner from './components/OfflineBanner'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'

function useToasterPosition(): 'bottom-right' | 'top-center' {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setMobile(mq.matches)
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
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/analytics" element={<AuthGuard><Analytics /></AuthGuard>} />
          <Route path="/stars" element={<AuthGuard><Stars /></AuthGuard>} />
          <Route path="/coach" element={<AuthGuard><Coach /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
          <Route path="*" element={<div className="p-8 text-center">404 - Page Not Found</div>} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
