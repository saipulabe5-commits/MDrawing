import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: '#F5F5F7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ width: '100%', maxWidth: '32rem', padding: '2rem', backgroundColor: '#FFFFFF', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #E5E5EA' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FF3B30', margin: '0 0 1.5rem 0' }}>Terjadi Kesalahan Tidak Terduga</h1>
            <div style={{ backgroundColor: '#F2F2F7', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', maxHeight: '10rem', marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: '#8E8E93', margin: 0 }}>
                {this.state.error?.message || "Unknown Error"}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{ backgroundColor: '#007AFF', color: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
              >
                Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
