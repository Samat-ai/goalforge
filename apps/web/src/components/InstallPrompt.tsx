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
    <div role="banner" aria-label="Install GoalForge" className="gf-install-banner">
      <div className="gf-install-ic">✦</div>
      <p className="gf-install-text">
        Add <strong>GoalForge</strong> to your home screen for the best experience
      </p>
      <button onClick={handleInstall} className="gf-install-btn">Install</button>
      <button onClick={handleDismiss} aria-label="Dismiss install prompt" className="gf-install-x">×</button>
    </div>
  )
}
