import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 8,
        border: `1px solid var(--border-color)`,
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-card)'
        e.currentTarget.style.color = 'var(--text-primary)'
        e.currentTarget.style.transform = 'scale(1.08)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      {isDark ? (
        <Sun size={15} strokeWidth={1.8} />
      ) : (
        <Moon size={15} strokeWidth={1.8} />
      )}
    </button>
  )
}
