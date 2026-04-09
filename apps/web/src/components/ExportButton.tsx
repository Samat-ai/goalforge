/**
 * ExportButton — Pro-gated "Export My Data" trigger.
 *
 * Usage (e.g. in Settings):
 *   <ExportButton userId={userId} />
 *
 * Behaviour:
 *  - Fetches a Bearer token via Clerk's useAuth()
 *  - GETs /users/{userId}/export?format=json
 *  - Triggers a browser download of the returned file
 *  - Shows a loading state while the request is in flight
 *  - Shows an inline error with a /billing link on HTTP 402 (Pro required)
 *  - Shows a generic error message for any other failure
 */

import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { T } from '../lib/theme'

interface ExportButtonProps {
  userId: string
  format?: 'json' | 'csv'
}

type ExportState = 'idle' | 'loading' | 'error_pro' | 'error_generic'

export default function ExportButton({
  userId,
  format = 'json',
}: ExportButtonProps) {
  const { getToken } = useAuth()
  const [state, setState] = useState<ExportState>('idle')

  async function handleExport() {
    if (state === 'loading') return
    setState('loading')

    try {
      const token = await getToken()
      const baseUrl =
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
        'http://localhost:8000'
      const url = `${baseUrl}/users/${encodeURIComponent(userId)}/export?format=${format}`

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'X-User-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      })

      if (response.status === 402) {
        setState('error_pro')
        return
      }

      if (!response.ok) {
        setState('error_generic')
        return
      }

      const blob = await response.blob()
      const datePart = new Intl.DateTimeFormat('en-CA').format(new Date())
      const ext = format === 'json' ? 'json' : 'zip'
      const filename = `goalforge-export-${datePart}.${ext}`

      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)

      setState('idle')
    } catch {
      setState('error_generic')
    }
  }

  const isLoading = state === 'loading'

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={() => { void handleExport() }}
        disabled={isLoading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          minHeight: 44,
          minWidth: 44,
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.surface,
          color: T.text,
          fontFamily: T.mono,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.04em',
          cursor: isLoading ? 'default' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
        aria-busy={isLoading}
        aria-label="Export my GoalForge data"
      >
        {isLoading ? 'Exporting\u2026' : 'Export My Data'}
      </button>

      {state === 'error_pro' && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: T.amber,
            fontFamily: T.mono,
            padding: '8px 12px',
            background: `${T.amber}12`,
            border: `1px solid ${T.amber}40`,
            borderRadius: 6,
          }}
        >
          Data export is a{' '}
          <strong style={{ color: T.amber }}>Pro</strong> feature.{' '}
          <a
            href="/billing"
            style={{ color: T.orange, textDecoration: 'underline' }}
          >
            Upgrade to Pro
          </a>
          .
        </div>
      )}

      {state === 'error_generic' && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: T.rose,
            fontFamily: T.mono,
            padding: '8px 12px',
            background: `${T.rose}12`,
            border: `1px solid ${T.rose}40`,
            borderRadius: 6,
          }}
        >
          Export failed. Please try again.
          <button
            onClick={() => setState('idle')}
            style={{
              marginLeft: 10,
              background: 'none',
              border: 'none',
              color: T.muted,
              fontFamily: T.mono,
              fontSize: 11,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
