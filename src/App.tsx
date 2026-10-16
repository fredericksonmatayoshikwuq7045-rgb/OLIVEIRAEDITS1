import { Check, HelpCircle, LoaderCircle, Settings as SettingsIcon, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from './data/useWorkspace';
import { installErrorHandlers, isNative, notifyCompleted } from './services/native';
import { Dashboard } from './ui/Dashboard';
import { DesktopClose } from './ui/DesktopClose';
import { Editor } from './ui/Editor';
import './ui/editor.css';
import { Help } from './ui/Help';
import { PanelBoundary } from './ui/PanelBoundary';
import { Button, IconButton } from './ui/Primitives';
import { Settings, type UiSettings } from './ui/Settings';
import { useEngine } from './ui/useEngine';
const defaultSettings: UiSettings = { concurrency: 1, confirmExport: true };
function readSettings(): UiSettings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('oe_ui_v2') || 'null');
    if (saved && typeof saved === 'object' && 'concurrency' in saved && [1, 2, 3].includes(Number(saved.concurrency)))
      return { concurrency: Number(saved.concurrency), confirmExport: true };
  } catch {
    /* Small UI preferences fall back safely. */
  }
  return defaultSettings;
}
export default function App() {
  const store = useWorkspace(),
    engine = useEngine();
  const [inEditor, setInEditor] = useState(false),
    [showSettings, setShowSettings] = useState(false),
    [showHelp, setShowHelp] = useState(false),
    [toast, setToast] = useState(''),
    [settings, setSettings] = useState(readSettings);
  const notify = useCallback((message: string) => setToast(message.replace(/^Error:\s*/, '')), []);
  useEffect(() => installErrorHandlers(), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    try {
      localStorage.setItem('oe_ui_v2', JSON.stringify(settings));
    } catch {
      notify('Não foi possível salvar as preferências da interface.');
    }
  }, [settings, notify]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const element = event.target;
      if (element instanceof HTMLElement && element.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === '?') {
        event.preventDefault();
        setShowHelp(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const completed = engine.jobs.filter((job) => job.status === 'completed');
    for (const job of completed) {
      const key = `oe_notified_${job.id}`;
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, '1');
      const ok = job.items.filter((item) => item.status === 'ok').length,
        failures = job.items.filter((item) => item.status === 'error').length;
      void notifyCompleted('Oliveira Edits · lote finalizado', `${ok} concluídos; ${failures} falhas.`).catch(console.error);
    }
  }, [engine.jobs]);
  const saveLabel = { loading: 'Carregando…', saved: 'Salvo', saving: 'Salvando…', error: 'Falha ao salvar' }[store.saveStatus];
  return (
    <div className="app">
      <header className="topbar">
        <div className="row" style={{ gap: 22 }}>
          <button
            className="brand"
            onClick={() => setInEditor(false)}
            style={{ background: 'none', border: 0, padding: 0, color: 'inherit' }}
            title="Ir para contas"
          >
            <span className="brand-mark">oe</span>
            <span>
              oliveira<span style={{ color: 'var(--accent)' }}>.</span>edits
            </span>
          </button>
          {inEditor && store.profile && (
            <div className="active-account">
              <span className="active-account-dot" style={{ background: store.profile.color }} />
              <div>
                <strong>{store.profile.name}</strong>
                <small>{store.profile.handle || 'Conta ativa'}</small>
              </div>
            </div>
          )}
        </div>
        <div className="row" style={{ gap: 14 }}>
          {!isNative() && <span className="web-indicator">NAVEGADOR · DESENVOLVIMENTO</span>}
          <span className="save-status">
            {store.saveStatus === 'saved' ? <Check size={12} /> : <LoaderCircle size={12} />}
            {saveLabel}
          </span>
          <IconButton label="Ajuda e atalhos (?)" onClick={() => setShowHelp(true)}>
            <HelpCircle size={17} />
          </IconButton>
          <IconButton label="Configurações do aplicativo" onClick={() => setShowSettings(true)}>
            <SettingsIcon size={17} />
          </IconButton>
        </div>
      </header>
      {store.loading ? (
        <div className="empty-state" aria-live="polite">
          <LoaderCircle size={28} />
          <h2>Preparando seu estúdio</h2>
          <p>Carregando contas e verificando a recuperação segura dos dados.</p>
        </div>
      ) : !store.workspace ? (
        <div className="empty-state">
          <h2>Não foi possível carregar os dados</h2>
          <p>{store.error}</p>
          <p>Seus dados antigos foram preservados. Consulte os logs e tente recarregar.</p>
          <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
        </div>
      ) : (
        <>
          <PanelBoundary name={inEditor ? 'editor' : 'contas'}>
            {inEditor ? (
              <Editor
                key={store.profile?.id}
                store={store}
                engine={engine}
                settings={settings}
                onBack={() => setInEditor(false)}
                notify={notify}
              />
            ) : (
              <Dashboard
                store={store}
                onOpen={(id) => {
                  store.activateProfile(id);
                  setInEditor(true);
                }}
                onSettings={() => setShowSettings(true)}
                notify={notify}
              />
            )}
          </PanelBoundary>
          {store.warnings.length > 0 && (
            <div className="import-warnings notice" role="status">
              <details>
                <summary>{store.warnings.length} aviso(s) sobre arquivos ou migração</summary>
                <ul>
                  {store.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </details>
              <IconButton label="Dispensar avisos" onClick={store.clearWarnings}>
                <X size={14} />
              </IconButton>
            </div>
          )}
          {store.error && (
            <div className="import-warnings error-message" role="alert">
              <span>{store.error}</span>
              <IconButton label="Fechar erro" onClick={store.clearError}>
                <X size={14} />
              </IconButton>
            </div>
          )}
        </>
      )}
      {showHelp && <Help onClose={() => setShowHelp(false)} />}
      {showSettings && (
        <Settings
          store={store}
          engine={engine}
          settings={settings}
          onSettings={setSettings}
          onClose={() => setShowSettings(false)}
          notify={notify}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <IconButton label="Fechar mensagem" onClick={() => setToast('')}>
            <X size={15} />
          </IconButton>
        </div>
      )}
      <DesktopClose store={store} engine={engine} />
    </div>
  );
}
