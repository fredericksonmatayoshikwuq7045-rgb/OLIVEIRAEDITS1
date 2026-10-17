import { useState } from 'react';
import type { MediaItem, Profile } from '../domain/models';
import {
  cleanMetadataOnly,
  exportItems,
  getImageExportReport,
  isNative,
  startExport,
  type ImageExportResult,
  type FinishAction,
  type JobState,
} from '../services/native';
import type { UiSettings } from './Settings';
import type { EngineState } from './useEngine';
export function useExportDialog({
  profile,
  items,
  engine,
  settings,
  onProfile,
  onClose,
  notify,
  initialMetadata = false,
}: {
  profile: Profile;
  items: MediaItem[];
  engine: EngineState;
  settings: UiSettings;
  onProfile: (profile: Profile) => void;
  onClose: () => void;
  notify: (message: string) => void;
  initialMetadata?: boolean;
}) {
  const [tab, setTab] = useState<'setup' | 'queue'>('setup'),
    [metadata, setMetadata] = useState(initialMetadata),
    [deep, setDeep] = useState(false),
    [moving, setMoving] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [finishAction, setFinishAction] = useState<FinishAction>('none');
  const [imageResults, setImageResults] = useState<ImageExportResult[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const ready = items.filter((item) => item.status === 'ready'),
    hasVideo = ready.some((item) => item.kind === 'video');
  const available = (!hasVideo && !metadata) || (isNative() && engine.info?.available);
  const jobs = jobId ? engine.jobs.filter((job) => job.id === jobId) : engine.jobs;
  const patch = (change: Partial<Profile['exportSettings']>) =>
    onProfile({ ...profile, exportSettings: { ...profile.exportSettings, ...change } });
  const run = async () => {
    if (
      !metadata &&
      hasVideo &&
      finishAction !== 'none' &&
      !window.confirm(
        'Ao concluir o lote sem falhas, o computador será ' +
          (finishAction === 'shutdown' ? 'desligado em 60 segundos.' : 'hibernado.') +
          ' Salve os outros aplicativos antes de continuar.',
      )
    )
      return;
    setBusy(true);
    setError('');
    setImageResults([]);
    try {
      const id = metadata
        ? await cleanMetadataOnly(profile, ready, { deepClean: deep, moveOriginal: moving })
        : await exportItems(profile, ready, { concurrency: settings.concurrency, finishAction });
      if (id === 'images-exported') {
        const images = getImageExportReport();
        setImageResults(images);
        setJobId('images-exported');
        setTab('queue');
        notify(
          `${images.filter((image) => image.status === 'ok' || image.status === 'download').length} imagens geradas; ${images.filter((image) => image.status === 'skipped').length} puladas; ${images.filter((image) => image.status === 'error').length} falhas.`,
        );
      } else {
        setJobId(id);
        await engine.refresh();
        setTab('queue');
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      if (!metadata) {
        const images = getImageExportReport();
        setImageResults(images);
        if (finishAction !== 'none' && hasVideo && images.some((image) => image.status === 'error')) {
          notify('A ação de desligar ou hibernar foi desativada porque uma imagem falhou. Confira o relatório.');
          setFinishAction('none');
        }
      }
      setBusy(false);
    }
  };
  const action = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await engine.refresh();
    } catch (reason) {
      setError(String(reason));
    }
  };
  const retryFailures = (job: JobState) =>
    action(async () => {
      const id = await startExport({
        ...job.request,
        finishAction: 'none',
        items: job.request.items.filter((item) => job.items.some((state) => state.id === item.id && state.status === 'error')),
      });
      setJobId(id);
      setTab('queue');
    });
  const sample = ready[0];
  return {
    imageResults,
    profile,
    items,
    engine,
    settings,
    onProfile,
    onClose,
    notify,
    initialMetadata,
    tab,
    setTab,
    metadata,
    setMetadata,
    deep,
    setDeep,
    moving,
    setMoving,
    busy,
    setBusy,
    error,
    setError,
    finishAction,
    setFinishAction,
    jobId,
    setJobId,
    ready,
    hasVideo,
    available,
    jobs,
    patch,
    run,
    action,
    retryFailures,
    sample,
  };
}
export type ExportDialogProps = Parameters<typeof useExportDialog>[0];
export type ExportDialogContext = ReturnType<typeof useExportDialog>;
