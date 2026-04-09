import { useRouteError, useNavigate } from 'react-router-dom'
import { T } from '../lib/theme'

function getErrorInfo(error: unknown): { status: number | null; message: string; headline: string } {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>

    const status = typeof e.status === 'number' ? e.status : null

    if (status === 404) {
      return {
        status,
        headline: 'Page not found',
        message: String(e.statusText ?? e.message ?? 'The page you requested does not exist.'),
      }
    }

    if (status && status >= 500) {
      return {
        status,
        headline: 'Something went wrong',
        message: String(e.statusText ?? e.message ?? 'An unexpected server error occurred.'),
      }
    }

    if (e instanceof TypeError || (e.name === 'TypeError')) {
      return {
        status: null,
        headline: 'Network error',
        message: String(e.message ?? 'A network error occurred. Please check your connection.'),
      }
    }

    if (typeof e.message === 'string') {
      return {
        status,
        headline: 'Something went wrong',
        message: e.message,
      }
    }
  }

  return {
    status: null,
    headline: 'Something went wrong',
    message: 'An unexpected error occurred.',
  }
}

const isDev = import.meta.env.DEV

export default function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { headline, message } = getErrorInfo(error)

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
      {/* Wordmark / logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 40,
          opacity: 0.7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill={T.indigo}
            stroke={T.indigo}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.textDim,
            letterSpacing: '0.06em',
            fontFamily: T.mono,
          }}
        >
          GOALFORGE
        </span>
      </div>

      {/* Error card */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.dim}`,
          borderTop: `3px solid ${T.rose}`,
          borderRadius: 16,
          padding: '44px 36px',
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <div
          style={{
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: `${T.rose}14`,
              border: `1px solid ${T.rose}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            ⚠
          </div>
        </div>

        <h1
          style={{
            fontFamily: T.serif,
            fontSize: 22,
            fontWeight: 700,
            color: T.text,
            marginBottom: 10,
            lineHeight: 1.3,
          }}
        >
          {headline}
        </h1>

        <p
          style={{
            fontSize: 14,
            color: T.textDim,
            lineHeight: 1.75,
            marginBottom: isDev ? 16 : 28,
          }}
        >
          Something unexpected happened. Your progress is safe — try going home or refreshing the
          page.
        </p>

        {/* Dev-only error details */}
        {isDev && message && (
          <pre
            style={{
              fontSize: 11,
              color: T.muted,
              fontFamily: T.mono,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 24,
              textAlign: 'left',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            {message}
          </pre>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              cursor: 'pointer',
              padding: '10px 22px',
              borderRadius: 10,
              fontFamily: T.mono,
              fontSize: 12,
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
            Go Home
          </button>

          <a
            href="https://github.com/goalforge-app/goalforge/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 22px',
              borderRadius: 10,
              fontFamily: T.mono,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              background: 'transparent',
              color: T.textDim,
              border: `1px solid ${T.border}`,
              textDecoration: 'none',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = T.borderHi
              e.currentTarget.style.color = T.text
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.border
              e.currentTarget.style.color = T.textDim
            }}
          >
            Report Issue ↗
          </a>
        </div>
      </div>
    </div>
  )
}
