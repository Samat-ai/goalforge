import { Navigate } from 'react-router-dom'

const ONBOARDING_COMPLETE_KEY = 'goalforge_onboarding_complete'

interface OnboardingGuardProps {
  children: React.ReactNode
}

/**
 * Wraps authenticated routes. If onboarding has not been completed,
 * redirects to /onboarding. Provides a "Skip for now" escape hatch
 * that marks onboarding as complete without going through the wizard.
 */
export default function OnboardingGuard({ children }: OnboardingGuardProps) {
  const isComplete = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true'

  if (!isComplete) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
