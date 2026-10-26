import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `ERR-MD-${Date.now().toString(36).toUpperCase()}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private sanitizeMessage(msg?: string): string {
    if (!msg) return "Terjadi gangguan sistem yang tidak terduga.";
    // Redact sensitive patterns (tokens, keys, bearer)
    return msg
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED_TOKEN]')
      .replace(/[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g, '[REDACTED_JWT]');
  }

  render() {
    if (this.state.hasError) {
      const sanitized = this.sanitizeMessage(this.state.error?.message);
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backgroundColor: '#0F172A', color: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ width: '100%', maxWidth: '32rem', padding: '2rem', backgroundColor: '#1E293B', borderRadius: '1rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', backgroundColor: '#EF444420', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', fontWeight: 'bold' }}>
                !
              </div>
              <div>
                <h1 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#F8FAFC', margin: 0 }}>Terjadi Kesalahan Aplikasi</h1>
                <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: 0 }}>ID Referensi: {this.state.errorId}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#0F172A', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', maxHeight: '8rem', overflow: 'auto', marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.8125rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: '#F87171', margin: 0, wordBreak: 'break-word' }}>
                {sanitized}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                onClick={() => window.history.back()}
                style={{ backgroundColor: '#334155', color: '#F8FAFC', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
              >
                Kembali
              </button>
              <button 
                onClick={() => window.location.reload()}
                style={{ backgroundColor: '#0284C7', color: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
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
