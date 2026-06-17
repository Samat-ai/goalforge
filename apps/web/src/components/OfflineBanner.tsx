import { useT } from '../lib/theme'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

/**
 * Fixed bottom banner shown when the browser is offline.
 * Uses the window 'online'/'offline' events via useOnlineStatus.
 * Copy is intentionally honest — we do not cache API calls, so we cannot
 * promise that offline actions will sync later.
 */
export default function OfflineBanner() {
  const T = useT()
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      className="animate-slide-up"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: `${T.amber}18`,
        borderTop: `1px solid ${T.amber}45`,
        backdropFilter: 'blur(8px)',
        padding: '11px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: T.mono,
        fontSize: 12,
        color: T.amber,
        letterSpacing: '0.02em',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.8 }}>◌</span>
      You are offline. Live syncing is paused.
    </div>
  )
}
