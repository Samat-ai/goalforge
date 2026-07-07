import { Component } from 'react'
import type { ReactNode } from 'react'

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
      <div className="mesh-bg min-h-dvh gf-err-wrap">
        <div className="gf-err-card">
          <div className="gf-err-icon">
            <div className="gf-err-icon-circle">✦</div>
          </div>
          <h2 className="gf-err-h2">Our AI is catching its breath.</h2>
          <p className="gf-err-p">
            Something went sideways on our end. Refreshing the page usually fixes it — your progress is safe.
          </p>
          {this.state.message && (
            <p className="gf-err-code">{this.state.message}</p>
          )}
          <button onClick={() => window.location.reload()} className="gf-err-btn">
            Refresh Page
          </button>
        </div>
      </div>
    )
  }
}
