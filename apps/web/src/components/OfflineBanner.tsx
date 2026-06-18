import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null
  return (
    <div
      className="animate-slide-up"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: 'color-mix(in oklab, var(--gold) 18%, transparent)',
        borderTop: '1px solid color-mix(in oklab, var(--gold) 45%, transparent)',
        backdropFilter: 'blur(8px)',
        padding: '11px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)', letterSpacing: '0.02em',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.8 }}>◌</span>
      You are offline. Live syncing is paused.
    </div>
  )
}
