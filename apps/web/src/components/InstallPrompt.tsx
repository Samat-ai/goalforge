import { useState, useEffect } from 'react'
import { useT } from '../lib/theme'

const DISMISS_KEY = 'pwa_install_dismissed'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export default function InstallPrompt() {
  const T = useT()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISS_KEY)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="banner"
      aria-label="Install GoalForge"
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 480,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 14,
        background: T.card2,
        border: `1px solid ${T.indigo}59`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(99,102,241,0.1)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      {/* Icon placeholder */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'rgba(99, 102, 241, 0.2)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>
        ✦
      </div>

      {/* Message */}
      <p style={{
        flex: 1,
        fontSize: 12,
        lineHeight: 1.5,
        color: T.textDim,
        fontFamily: T.body,
        margin: 0,
      }}>
        Add <strong style={{ color: T.text }}>GoalForge</strong> to your home screen for the best experience
      </p>

      {/* Install button */}
      <button
        onClick={handleInstall}
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid rgba(99, 102, 241, 0.5)',
          background: 'rgba(99, 102, 241, 0.2)',
          color: '#a5b4fc',
          fontFamily: T.mono,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          minHeight: 44,
          minWidth: 44,
          whiteSpace: 'nowrap',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(99, 102, 241, 0.35)'
          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.7)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'
          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)'
        }}
      >
        Install
      </button>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        style={{
          flexShrink: 0,
          width: 32, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none',
          background: 'transparent',
          color: T.muted,
          cursor: 'pointer',
          fontSize: 16,
          padding: 0,
          borderRadius: 6,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = T.textDim }}
        onMouseLeave={e => { e.currentTarget.style.color = T.muted }}
      >
        ×
      </button>
    </div>
  )
}
