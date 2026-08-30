import { Component, type ErrorInfo, type ReactNode } from 'react'
import { LunaraMark } from './LunaraMark'

interface Props {
  children: ReactNode
}

interface State {
  error?: Error
}

export class StartupErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Periodus startup] React failed to render.', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="startup-failure-shell">
        <div className="page startup-failure-page">
          <section className="card startup-failure-card" role="alert">
            <span className="startup-failure-mark" aria-hidden="true">
              <LunaraMark decorative size={34} />
            </span>
            <p className="page-kicker">Startup interrupted</p>
            <h1>Periodus couldn’t open.</h1>
            <p className="muted">
              Your local health data has not been deleted. Reload the app and,
              if this keeps happening, share the technical detail below.
            </p>
            <button className="cta" type="button" onClick={() => window.location.reload()}>
              Reload Periodus
            </button>
            <details className="startup-failure-details">
              <summary>Technical detail</summary>
              <code>{`${error.name}: ${error.message}`}</code>
            </details>
          </section>
        </div>
      </main>
    )
  }
}
