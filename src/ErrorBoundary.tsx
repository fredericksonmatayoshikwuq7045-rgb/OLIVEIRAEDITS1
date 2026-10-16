import React from "react";

interface State { error: Error | null; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Oliveira Edits crashed:", error, info);
  }

  handleReset = () => {
    if (confirm("Isso vai limpar todos os dados salvos (vídeos, imagens, templates) e recarregar. Continuar?")) {
      localStorage.removeItem("oe_videos");
      localStorage.removeItem("oe_images");
      localStorage.removeItem("oe_groups");
      localStorage.removeItem("oe_templates");
      window.location.reload();
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", background: "#0a0a0a", color: "#e8e8e8",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          fontFamily: "monospace", padding: 24, textAlign: "center", gap: 16,
        }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>Algo quebrou no Oliveira Edits</p>
          <pre style={{
            background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8,
            padding: 16, fontSize: 11, maxWidth: 600, overflow: "auto", textAlign: "left", color: "#aaa",
          }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => window.location.reload()}
              style={{ background: "#2a2a2a", border: "1px solid #444", color: "#ccc", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>
              Recarregar
            </button>
            <button onClick={this.handleReset}
              style={{ background: "#dc2626", border: "1px solid #dc2626", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>
              Limpar dados e recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
