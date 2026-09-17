import React from 'react';
import { ErrorState } from './ErrorState';
import { recordCrash } from '../../lib/reliability';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches React rendering errors and displays a fallback UI.
 * Follows DESIGN.md: uses ErrorState component for consistent error display.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Every caught render error counts against the crash-rate metric — a
    // caught error is still a broken screen for the user.
    recordCrash({ source: 'react', message: error.message, stack: error.stack });
    // Log to console in development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorState
          message={this.state.error?.message ?? '发生了未知错误'}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
