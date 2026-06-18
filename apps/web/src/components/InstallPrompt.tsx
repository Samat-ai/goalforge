import { useState, useEffect } from 'react'

const DISMISS_KEY = 'pwa_install_dismissed'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
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
    if (outcome === 'accepted') setVisible(false)
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
        left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)', maxWidth: 480,
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 14,
        background: 'var(--card-2)',
        border: '1px solid color-mix(in oklab, var(--indigo) 35%, transparent)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(12px)',
        animation: 'slide-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'color-mix(in oklab, var(--indigo) 20%, transparent)',
        border: '1px solid color-mix(in oklab, var(--indigo) 30%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>✦</div>

      <p style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: 'var(--text-dim)', fontFamily: 'var(--font-display)', margin: 0 }}>
        Add <strong style={{ color: 'var(--text)' }}>GoalForge</strong> to your home screen for the best experience
      </p>

      <button
        onClick={handleInstall}
        style={{
          flexShrink: 0, padding: '8px 14px', borderRadius: 8,
          border: '1px solid color-mix(in oklab, var(--indigo) 50%, transparent)',
          background: 'color-mix(in oklab, var(--indigo) 20%, transparent)',
          color: 'var(--indigo)',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
          cursor: 'pointer', minHeight: 44, minWidth: 44, whiteSpace: 'nowrap',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        Install
      </button>

      <button
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        style={{
          flexShrink: 0, width: 32, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', color: 'var(--text-mute)',
          cursor: 'pointer', fontSize: 16, padding: 0, borderRadius: 6, transition: 'color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-dim)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-mute)' }}
      >
        ×
      </button>
    </div>
  )
}
