import React from 'react'
import { T } from '../lib/theme'

interface Props {
  children: React.ReactNode
  section?: string
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class QueryErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error(`[GoalForge] QueryErrorBoundary caught in "${this.props.section ?? 'unknown'}":`, error, info.componentStack)
  }

  retry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    const { section, } = this.props
    const label = section ? `Failed to load ${section}` : 'Something went wrong'

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          padding: '16px 20px',
          borderRadius: 12,
          background: `${T.rose}10`,
          border: `1px solid ${T.rose}30`,
          borderLeft: `3px solid ${T.rose}`,
          margin: '8px 0',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.rose, marginBottom: 3 }}>
            {label}
          </div>
          {this.state.error?.message && (
            <div style={{
              fontSize: 11,
              color: T.muted,
              fontFamily: T.mono,
              wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </div>
          )}
        </div>
        <button
          onClick={this.retry}
          style={{
            cursor: 'pointer',
            padding: '7px 16px',
            minHeight: 36,
            borderRadius: 8,
            flexShrink: 0,
            fontFamily: T.mono,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.04em',
            background: `${T.rose}20`,
            color: T.rose,
            border: `1px solid ${T.rose}50`,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          Retry
        </button>
      </div>
    )
  }
}
