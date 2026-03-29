import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import AuthInterceptor from './components/AuthInterceptor'
import './index.css'
import App from './App.tsx'
import { ConfettiProvider } from './components/ConfettiContext'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const resolvedPublishableKey = publishableKey ?? (isE2EMode ? 'pk_test_e2e_mode' : undefined)

if (!resolvedPublishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local')
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Best-effort registration; app should still run without SW.
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={resolvedPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <ConfettiProvider>
          {!isE2EMode && <AuthInterceptor />}
          <App />
        </ConfettiProvider>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
)
