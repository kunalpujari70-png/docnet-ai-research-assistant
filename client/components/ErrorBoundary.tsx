import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem'
          }}>
            🚨
          </div>
          <h1 style={{
            fontSize: '2rem',
            marginBottom: '1rem',
            color: '#ef4444'
          }}>
            Something went wrong
          </h1>
          <p style={{
            fontSize: '1.1rem',
            marginBottom: '2rem',
            maxWidth: '500px',
            lineHeight: '1.6'
          }}>
            We encountered an unexpected error. This might be a temporary issue.
          </p>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{
              marginBottom: '2rem',
              padding: '1rem',
              background: 'var(--bg-secondary)',
              borderRadius: '0.5rem',
              maxWidth: '600px',
              width: '100%'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Error Details (Development)
              </summary>
              <pre style={{
                marginTop: '1rem',
                fontSize: '0.9rem',
                overflow: 'auto',
                textAlign: 'left'
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}

          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
