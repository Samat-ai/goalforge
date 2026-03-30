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
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: T.mono,
        }}
      >
        <div style={{
          background: T.card,
          border: `1px solid ${T.dim}`,
          borderTop: `3px solid ${T.orange}`,
          borderRadius: 16,
          padding: '44px 36px',
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
        }}>
          {/* Animated icon */}
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: `${T.orange}14`,
              border: `1px solid ${T.orange}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
            }}>
              ✦
            </div>
          </div>

          <h2 style={{
            fontFamily: T.serif,
            fontSize: 22,
            fontWeight: 600,
            color: T.text,
            marginBottom: 10,
            lineHeight: 1.3,
          }}>
            Our AI is catching its breath.
          </h2>

          <p style={{
            fontSize: 13,
            color: T.textDim,
            lineHeight: 1.75,
            marginBottom: 8,
          }}>
            Something went sideways on our end. Refreshing the page usually fixes it — your progress is safe.
          </p>

          {this.state.message && (
            <p style={{
              fontSize: 11,
              color: T.muted,
              fontFamily: T.mono,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 24,
              textAlign: 'left',
              wordBreak: 'break-word',
            }}>
              {this.state.message}
            </p>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              cursor: 'pointer',
              padding: '11px 28px',
              borderRadius: 10,
              fontFamily: T.mono,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              background: T.orange,
              color: '#fff',
              border: 'none',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }
}
