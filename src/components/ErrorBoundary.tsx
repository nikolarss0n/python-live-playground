import { Component, type ReactNode } from 'react'
import './ErrorBoundary.css'

type ErrorBoundaryProps = { children: ReactNode; reload?: () => void }
type ErrorBoundaryState = { failed: boolean }
const reloadPage = () => window.location.reload()

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app-error">
        <div className="app-error-message" role="alert">
          <h1>This page stopped working</h1>
          <p>Reload the page to continue. Code and progress already saved on this device are kept.</p>
          <button type="button" className="btn btn-primary" onClick={this.props.reload ?? reloadPage}>Reload page</button>
        </div>
      </main>
    )
  }
}
