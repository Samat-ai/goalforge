import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Show } from '@clerk/react'
import { Toaster } from 'sonner'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import Settings from './pages/Settings'
import ErrorBoundary from './components/ErrorBoundary'

function AuthGuard({ children }: { children: React.ReactNode }) {
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
      <Toaster theme="dark" position="bottom-right" richColors />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/analytics" element={<AuthGuard><Analytics /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
