import { logError } from './services/backend';
import { Component, type ErrorInfo, type ReactNode } from 'react';
interface State {
  error: Error | null;
}
/** Recovery never deletes user data. Panels have their own isolated boundaries. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void logError(new Error(`Falha no Oliveira Edits: ${error.message}\n${info.componentStack ?? ''}\n${error.stack ?? ''}`));
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ padding: 40, maxWidth: 700, margin: '10vh auto', display: 'grid', gap: 20 }}>
        <h1>Não foi possível abrir o editor</h1>
        <p>Seus arquivos e dados salvos foram preservados. Recarregue o aplicativo e consulte os logs se o problema continuar.</p>
        <pre className="log">{this.state.error.message}</pre>
        <button className="button button-primary" onClick={() => window.location.reload()}>
          Recarregar aplicativo
        </button>
      </main>
    );
  }
}
