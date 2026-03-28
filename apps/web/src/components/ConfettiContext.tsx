import { createContext, useCallback, useContext, useMemo } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiContextValue {
  fireBadgeConfetti: () => void
}

const ConfettiContext = createContext<ConfettiContextValue | null>(null)

export function ConfettiProvider({ children }: { children: React.ReactNode }) {
  const fireBadgeConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      startVelocity: 45,
      scalar: 0.95,
      origin: { y: 0.58 },
      colors: ['#22c55e', '#fbbf24', '#60a5fa', '#f97316'],
    })
  }, [])

  const value = useMemo(() => ({ fireBadgeConfetti }), [fireBadgeConfetti])

  return (
    <ConfettiContext.Provider value={value}>
      {children}
    </ConfettiContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfetti() {
  const context = useContext(ConfettiContext)
  if (!context) {
    throw new Error('useConfetti must be used within ConfettiProvider')
  }
  return context
}
