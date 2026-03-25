import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Renders nothing. Captures `?energy=low` from the URL into sessionStorage
 * before Clerk's AuthGuard redirects unauthenticated users to /sign-in,
 * which would strip the query param.
 *
 * Dashboard reads `sessionStorage.getItem('energy')` on mount and opens
 * the EnergyModal when the value is 'low'.
 */
export default function EnergyParamCapture() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('energy') === 'low') {
      sessionStorage.setItem('energy', 'low')
      // Clean the param from the URL without a navigation
      const url = new URL(window.location.href)
      url.searchParams.delete('energy')
      window.history.replaceState(null, '', url.toString())
    }
  }, [searchParams])

  return null
}
