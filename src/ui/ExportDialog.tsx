import { ExportSetup } from './ExportSetup';
import { Modal } from './Primitives';
import { QueueReport } from './QueueReport';
import { useExportDialog, type ExportDialogProps } from './useExportDialog';
export function ExportDialog(props: ExportDialogProps) {
  const model = useExportDialog(props);
  const { metadata, onClose, profile, tab, setTab, error } = model;
  return (
    <Modal title={metadata ? 'Limpar metadados em lote' : 'Exportar projeto'} onClose={onClose} wide>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div className="row">
          <span style={{ background: profile.color, width: 9, height: 9, borderRadius: 3 }} />
          <strong>{profile.name}</strong>
          <span className="muted">{profile.handle}</span>
        </div>
        <div className="mini-tabs">
          <button className={tab === 'setup' ? 'active' : ''} onClick={() => setTab('setup')}>
            Preparar lote
          </button>
          <button className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}>
            Fila e relatório
          </button>
        </div>
      </div>
      {error && (
        <div className="error-message" style={{ marginBottom: 15 }}>
          {error}
        </div>
      )}
      {tab === 'setup' ? <ExportSetup model={model} /> : <QueueReport model={model} />}
    </Modal>
  );
}
