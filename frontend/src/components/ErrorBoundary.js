import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || 'An unexpected error occurred';
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <h1 className="error-boundary-title">Something went wrong</h1>
            <p className="error-boundary-message">{message}</p>
            <div className="error-boundary-actions">
              <button className="btn" onClick={this.handleReload}>Reload page</button>
              <button className="btn" onClick={this.handleReset}>Go to home</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
