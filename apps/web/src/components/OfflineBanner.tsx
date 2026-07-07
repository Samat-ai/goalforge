import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null
  return (
    <div className="gf-offline-banner animate-slide-up" role="status" aria-live="polite">
      <span aria-hidden="true" className="gf-offline-dot">◌</span>
      You are offline. Live syncing is paused.
    </div>
  )
}
