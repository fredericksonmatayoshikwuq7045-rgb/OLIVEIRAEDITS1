import { logError } from '../services/backend';
import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Primitives';

export class PanelBoundary extends Component<{ children: ReactNode; name: string }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void logError(new Error(`Falha no painel ${this.props.name}: ${error.message}\n${info.componentStack ?? ''}\n${error.stack ?? ''}`));
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel-error" role="alert">
        <AlertTriangle size={24} />
        <h3>Não foi possível abrir {this.props.name}</h3>
        <p>{this.state.error}</p>
        <Button onClick={() => this.setState({ error: null })}>Tentar novamente</Button>
        <small>Seus arquivos e dados foram preservados.</small>
      </div>
    );
  }
}
