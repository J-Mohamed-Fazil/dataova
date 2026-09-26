import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Datanova ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#050B17', color: '#f87171',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '2rem', fontFamily: 'monospace'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️ App Crashed</div>
          <div style={{
            background: '#0f172a', border: '1px solid #f87171', borderRadius: '8px',
            padding: '1.5rem', maxWidth: '700px', width: '100%',
            color: '#fca5a5', fontSize: '0.85rem', lineHeight: 1.7,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word'
          }}>
            <strong style={{ color: '#ef4444' }}>{this.state.error.name}: {this.state.error.message}</strong>
            {this.state.error.stack && (
              <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                {this.state.error.stack}
              </div>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem', padding: '0.6rem 2rem',
              background: '#0891b2', color: '#fff', border: 'none',
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem'
            }}
          >
            🔄 Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
