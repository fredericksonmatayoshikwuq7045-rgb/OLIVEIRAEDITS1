import { Copy, FolderOpen, Pause, Play, RefreshCw, Square } from 'lucide-react';
import { cancelExport, openPath, pauseExport, resumeExport, type ItemState, type JobState } from '../services/native';
import { exportTotals, jobOutputDirectories } from '../services/exportReport';
import { Button, humanBytes } from './Primitives';
import type { ExportDialogContext } from './useExportDialog';

const statusLabels: Record<ItemState['status'], string> = {
  pending: 'Pendente',
  processing: 'Processando',
  ok: 'Concluído',
  error: 'Erro',
  cancelled: 'Cancelado',
  skipped: 'Pulado',
};
function reportText(jobs: JobState[]) {
  return [
    'Arquivo\tStatus\tTempo (s)\tTamanho\tErro',
    ...jobs.flatMap((job) =>
      job.items.map((item) =>
        [
          item.outputPath,
          statusLabels[item.status],
          item.durationMs !== null ? (item.durationMs / 1000).toFixed(2) : '',
          item.outputSize !== null ? humanBytes(item.outputSize) : '',
          item.error || '',
        ].join('\t'),
      ),
    ),
  ].join('\n');
}

export function QueueReport({ model }: { model: ExportDialogContext }) {
  const { jobs, imageResults, notify, setError, action, retryFailures } = model;
  const totals = exportTotals(jobs, imageResults);
  return (
    <div className="stack">
      <div className="row-between">
        <div className="queue-summary">
          <span>{totals.completed} concluídos</span>
          <span>{totals.failed} falhas</span>
          {totals.skipped > 0 && <span>{totals.skipped} pulados</span>}
        </div>
        <Button
          onClick={() =>
            void navigator.clipboard
              .writeText(
                reportText(jobs) +
                  '\n' +
                  imageResults
                    .map((image) =>
                      [
                        image.path || image.filename,
                        image.status,
                        '',
                        image.bytes === undefined ? '' : humanBytes(image.bytes),
                        image.error ?? '',
                      ].join('\t'),
                    )
                    .join('\n'),
              )
              .then(() => notify('Relatório copiado.'))
              .catch((reason) => setError(String(reason)))
          }
        >
          <Copy /> Copiar relatório
        </Button>
      </div>
      {jobs.length === 0 && imageResults.length === 0 && (
        <p className="muted">Nenhum lote iniciado. Prepare uma exportação para acompanhar o progresso real aqui.</p>
      )}
      {imageResults.map((image) => (
        <div key={image.id} className="queue-item">
          <div className="row-between">
            <strong>{image.filename}</strong>
            <span>{{ ok: 'Gravado', download: 'Download iniciado', skipped: 'Pulado', error: 'Falha' }[image.status]}</span>
          </div>
          {image.bytes !== undefined && <small>{humanBytes(image.bytes)}</small>}
          {image.error && <p className="error-message">{image.error}</p>}
        </div>
      ))}
      {jobs.map((job) => (
        <div className="stack" key={job.id}>
          <div className="row-between">
            <small className="mono">
              Lote {job.id.slice(0, 8)} ·{' '}
              {job.status === 'paused'
                ? 'Pausado entre arquivos'
                : job.status === 'completed'
                  ? 'Finalizado'
                  : job.status === 'cancelled'
                    ? 'Cancelado'
                    : 'Em andamento'}
            </small>
            <div className="row">
              {(job.status === 'running' || job.status === 'pending' || job.status === 'paused') && (
                <>
                  <Button onClick={() => void action(() => pauseExport(job.id, job.status !== 'paused'))}>
                    {job.status === 'paused' ? <Play /> : <Pause />}
                    {job.status === 'paused' ? 'Continuar' : 'Pausar após arquivo'}
                  </Button>
                  <Button variant="danger" onClick={() => void action(() => cancelExport(job.id))}>
                    <Square /> Cancelar lote
                  </Button>
                </>
              )}
              {job.items.some((i) => i.status === 'error') && (
                <Button onClick={() => void retryFailures(job)}>
                  <RefreshCw /> Repetir falhas
                </Button>
              )}
              {job.items.some((i) => i.status === 'pending' || i.status === 'cancelled') && job.status !== 'running' && (
                <Button onClick={() => void action(() => resumeExport(job.id))}>
                  <Play /> Retomar
                </Button>
              )}
            </div>
          </div>
          {job.warnings.map((warning) => (
            <div className="notice" key={warning}>
              {warning}
            </div>
          ))}
          <div className="queue-list">
            {job.items.map((item) => (
              <div key={item.id} className="queue-item">
                <div className="row-between">
                  <strong className="truncate tiny" title={item.outputPath}>
                    {item.outputPath.split(/[/\\]/).at(-1)}
                  </strong>
                  <span className={`badge ${item.status === 'ok' ? 'badge-success' : item.status === 'error' ? 'badge-error' : ''}`}>
                    {statusLabels[item.status]}
                  </span>
                </div>
                <div className="queue-item-meta">
                  <span>{Math.round(item.progress.percent)}%</span>
                  {item.progress.fps !== null && <span>{item.progress.fps.toFixed(1)} fps</span>}
                  {item.progress.speed !== null && <span>{item.progress.speed.toFixed(2)}×</span>}
                  {item.progress.outSizeBytes !== null && <span>{humanBytes(item.progress.outSizeBytes)}</span>}
                  {item.progress.etaSeconds !== null && <span>Faltam ~{Math.ceil(item.progress.etaSeconds)}s</span>}
                  {item.durationMs !== null && <span>{(item.durationMs / 1000).toFixed(1)}s</span>}
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, item.progress.percent))}%` }} />
                </div>
                {item.error && (
                  <div className="error-message" style={{ marginTop: 10 }}>
                    {item.error}
                  </div>
                )}
                {item.metadata && (
                  <details style={{ marginTop: 10 }}>
                    <summary className={item.metadata.sensitiveRemaining.length ? 'danger-text' : 'success-message'}>
                      {item.metadata.removed.length} tags removidas · {item.metadata.sensitiveRemaining.length} tags sensíveis remanescentes
                    </summary>
                    <div className="metadata-tags">
                      <div>
                        <strong>Antes</strong>
                        <pre className="log">{JSON.stringify(item.metadata.before, null, 2)}</pre>
                      </div>
                      <div>
                        <strong>Depois</strong>
                        <pre className="log">{JSON.stringify(item.metadata.after, null, 2)}</pre>
                      </div>
                    </div>
                  </details>
                )}
                <details style={{ marginTop: 9 }}>
                  <summary className="muted tiny">Diagnóstico e caminhos</summary>
                  <pre className="log">
                    Entrada: {item.sourcePath}
                    {'\n'}Saída: {item.outputPath}
                    {'\n'}Log: {item.logPath || 'Aguardando processamento'}
                    {item.error ? `\n${item.error}` : ''}
                  </pre>
                  {item.logPath && (
                    <Button onClick={() => void openPath(item.logPath!).catch((reason) => setError(String(reason)))}>
                      Abrir log completo
                    </Button>
                  )}
                </details>
              </div>
            ))}
          </div>
          {jobOutputDirectories(job).map((directory) => (
            <Button key={directory} title={directory} onClick={() => void openPath(directory).catch((reason) => setError(String(reason)))}>
              <FolderOpen /> Abrir pasta de saída · {directory}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
