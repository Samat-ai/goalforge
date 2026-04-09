import { useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { T } from '../lib/theme'

export default function OfflinePage() {
  // Auto-reload when connection is restored
  useEffect(() => {
    function handleOnline() {
      window.location.reload()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return (
    <div
      className="mesh-bg min-h-dvh"
      style={{
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        fontFamily: T.serif,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `${T.indigo}14`,
          border: `1px solid ${T.indigo}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
        }}
      >
        <WifiOff size={36} color={T.indigo} strokeWidth={1.5} />
      </div>

      {/* Headline */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: T.text,
          marginBottom: 14,
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        You're offline
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontSize: 15,
          color: T.textDim,
          textAlign: 'center',
          maxWidth: 400,
          lineHeight: 1.75,
          marginBottom: 36,
        }}
      >
        GoalForge needs a connection to sync your goals. Your completed tasks are saved and will
        sync when you're back online.
      </p>

      {/* Pulsing "waiting for connection" indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 32,
          padding: '10px 18px',
          borderRadius: 10,
          background: T.card,
          border: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: T.amber,
            animation: 'companion-pulse 2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 13,
            color: T.textDim,
            fontFamily: T.mono,
            letterSpacing: '0.02em',
          }}
        >
          Waiting for connection…
        </span>
      </div>

      {/* Refresh button */}
      <button
        onClick={() => window.location.reload()}
        style={{
          cursor: 'pointer',
          padding: '11px 28px',
          borderRadius: 10,
          fontFamily: T.mono,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.05em',
          background: T.indigo,
          color: '#fff',
          border: 'none',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        Try Again
      </button>
    </div>
  )
}
