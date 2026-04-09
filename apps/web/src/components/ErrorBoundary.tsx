import { Component } from 'react'
import type { ReactNode } from 'react'
import { T } from '../lib/theme'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

const isDev = import.meta.env.DEV

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error('[GoalForge] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        className="mesh-bg min-h-dvh"
        style={{
          background: T.bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: T.serif,
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36, opacity: 0.6 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              fill={T.indigo}
              stroke={T.indigo}
              strokeWidth="1"
            />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textDim, letterSpacing: '0.06em', fontFamily: T.mono }}>
            GOALFORGE
          </span>
        </div>

        <div style={{
          background: T.card,
          border: `1px solid ${T.dim}`,
          borderTop: `3px solid ${T.rose}`,
          borderRadius: 16,
          padding: '44px 36px',
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
        }}>
          {/* Icon */}
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: `${T.rose}14`,
              border: `1px solid ${T.rose}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}>
              ⚠
            </div>
          </div>

          <h2 style={{
            fontFamily: T.serif,
            fontSize: 22,
            fontWeight: 700,
            color: T.text,
            marginBottom: 10,
            lineHeight: 1.3,
          }}>
            Something went wrong
          </h2>

          <p style={{
            fontSize: 14,
            color: T.textDim,
            lineHeight: 1.75,
            marginBottom: isDev && this.state.message ? 16 : 28,
          }}>
            Something went sideways on our end. Reloading the page usually fixes it — your progress is safe.
          </p>

          {isDev && this.state.message && (
            <pre style={{
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
            }}>
              {this.state.message}
            </pre>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                cursor: 'pointer',
                padding: '10px 26px',
                borderRadius: 10,
                fontFamily: T.mono,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                background: T.indigo,
                color: '#fff',
                border: 'none',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              Reload page
            </button>

            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              style={{
                cursor: 'pointer',
                padding: '10px 22px',
                borderRadius: 10,
                fontFamily: T.mono,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.05em',
                background: 'transparent',
                color: T.textDim,
                border: `1px solid ${T.border}`,
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
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
}
