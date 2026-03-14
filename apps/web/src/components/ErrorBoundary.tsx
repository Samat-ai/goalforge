import { Component } from 'react'
import { T } from '../lib/theme'

interface Props {
  children: React.ReactNode
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

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', background: T.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          background: T.card, border: `1px solid ${T.rose}40`,
          borderRadius: 14, padding: '36px 32px', maxWidth: 480, width: '100%',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚠</div>
          <h2 style={{
            fontFamily: T.serif, fontSize: 20, color: T.text,
            marginBottom: 10, fontWeight: 500,
          }}>
            Something went wrong
          </h2>
          <p style={{
            fontSize: 12, color: T.muted, fontFamily: T.mono,
            lineHeight: 1.7, marginBottom: 24,
          }}>
            {this.state.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              cursor: 'pointer', padding: '9px 22px', borderRadius: 8,
              fontFamily: T.mono, fontSize: 12, fontWeight: 500,
              letterSpacing: '0.04em', background: T.orange, color: '#fff', border: 'none',
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }
}
