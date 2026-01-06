import { Component, ReactNode } from 'react'
import { MacButton } from './ui/MacButton'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
          <div className="text-center max-w-md px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-text-primary mb-2">出错了</h1>
            <p className="text-sm text-text-secondary mb-4">
              应用遇到了一个错误，请尝试重新加载。
            </p>
            {this.state.error && (
              <p className="text-xs text-text-tertiary mb-4 font-mono bg-bg-secondary p-2 rounded">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <MacButton variant="primary" onClick={this.handleRetry}>
                重试
              </MacButton>
              <MacButton variant="secondary" onClick={() => window.location.reload()}>
                刷新页面
              </MacButton>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
