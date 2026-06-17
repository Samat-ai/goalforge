import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'gf-theme'

interface ThemeContextType {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  resolved: 'dark',
  setMode: () => {},
})

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch { /* ignore */ }
  return 'dark'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(mode: ThemeMode, sysDark: boolean): ResolvedTheme {
  if (mode === 'system') return sysDark ? 'dark' : 'light'
  return mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  const [sysDark, setSysDark] = useState<boolean>(() => systemPrefersDark())

  // Track OS preference for 'system' mode.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSysDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolved = resolve(mode, sysDark)

  // Apply to <html> and persist.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', resolved)
    root.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  function setMode(m: ThemeMode) {
    try { localStorage.setItem(STORAGE_KEY, m) } catch { /* ignore */ }
    setModeState(m)
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeMode() {
  return useContext(ThemeContext)
}

export function useResolvedTheme(): ResolvedTheme {
  return useContext(ThemeContext).resolved
}
