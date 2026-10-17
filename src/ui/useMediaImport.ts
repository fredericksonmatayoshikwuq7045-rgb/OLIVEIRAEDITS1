import { useCallback, useEffect, useRef, useState } from 'react';
import { chooseMediaFiles, chooseMediaFolder, isNative } from '../services/native';
import type { WorkspaceStore } from './Dashboard';

export function useMediaImport(store: WorkspaceStore, notify: (message: string) => void) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ completed: number; total: number } | null>(null);
  const busy = useRef(false),
    mounted = useRef(true),
    latest = useRef({ store, notify });
  latest.current = { store, notify };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async (selectFiles: () => Promise<File[] | string[]>) => {
    if (busy.current) return;
    busy.current = true;
    setImporting(true);
    setImportProgress(null);
    const destination = latest.current.store;
    try {
      const files = await selectFiles();
      if (!mounted.current || !files.length) return;
      if (destination.profile?.id !== latest.current.store.profile?.id || destination.project?.id !== latest.current.store.project?.id) {
        latest.current.notify('Importação cancelada porque o projeto aberto mudou.');
        return;
      }
      const result = await destination.importFiles(files, (progress) => {
        if (mounted.current) setImportProgress(progress);
      });
      const details = [result.failed ? `${result.failed} com falha` : '', result.ignored ? `${result.ignored} ignorado(s)` : ''].filter(
        Boolean,
      );
      latest.current.notify(
        `${result.imported} mídia(s) importada(s)${details.length ? `; ${details.join(', ')}. Confira os avisos.` : '.'}`,
      );
    } catch (error) {
      latest.current.notify(String(error));
    } finally {
      busy.current = false;
      if (mounted.current) {
        setImporting(false);
        setImportProgress(null);
      }
    }
  }, []);
  const importFiles = useCallback((files: File[] | string[]) => run(() => Promise.resolve(files)), [run]);
  const importMedia = useCallback((folder = false) => run(folder ? chooseMediaFolder : chooseMediaFiles), [run]);
  useEffect(() => {
    if (!isNative()) return;
    let stop: (() => void) | undefined,
      disposed = false;
    void import('@tauri-apps/api/webview')
      .then(async ({ getCurrentWebview }) => {
        const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === 'drop') void importFiles(event.payload.paths);
        });
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch((error) => latest.current.notify(String(error)));
    return () => {
      disposed = true;
      stop?.();
    };
  }, [importFiles]);
  return { importing, importProgress, importFiles, importMedia };
}
