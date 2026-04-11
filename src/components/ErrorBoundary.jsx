/* SAMSARA - Error Boundary */
import { Component } from 'react';
import T from '../utils/tokens';

export default class ErrorBoundary extends Component {
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

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        background: T.bg,
        color: T.t1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        fontFamily: T.fb,
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: T.fd,
          fontSize: 28,
          fontWeight: 300,
          color: T.gold,
          marginBottom: 16,
          letterSpacing: 0.5,
        }}>
          Something went wrong
        </h1>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '14px 20px',
          maxWidth: 360,
          width: '100%',
          marginBottom: 32,
          fontFamily: T.fm,
          fontSize: 12,
          color: T.t2,
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}>
          {this.state.error?.message || 'Unknown error'}
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            background: T.gold,
            color: T.bg,
            border: 'none',
            borderRadius: 10,
            padding: '14px 36px',
            fontSize: 15,
            fontFamily: T.fb,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 14,
            letterSpacing: 0.3,
          }}
        >
          Reload App
        </button>

        <button
          onClick={() => { localStorage.clear(); window.location.reload(); }}
          style={{
            background: 'transparent',
            color: T.red,
            border: `1px solid ${T.red}`,
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 12,
            fontFamily: T.fb,
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: 0.2,
          }}
        >
          Clear Data &amp; Reload
        </button>
      </div>
    );
  }
}
