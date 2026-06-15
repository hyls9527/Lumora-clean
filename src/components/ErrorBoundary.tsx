import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-screen bg-bg">
          <div className="text-center">
            <p className="font-serif text-[16px] text-text-muted mb-2">
              此处尚有未竟之事
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="font-serif text-[13px] text-accent hover:underline"
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
