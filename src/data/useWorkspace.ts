import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkspace, isoNow } from '../domain/defaults';
import type { History } from '../domain/history';
import { commitHistory, createHistory, redoHistory, undoHistory } from '../domain/history';
import type { Project, Workspace } from '../domain/models';
import { AssetManager } from './assets';
import { mediaActions } from './mediaActions';
import { captureLegacySnapshot, LEGACY_KEYS, migrateLegacy } from './migration';
import { profileActions } from './workspaceActions';
import { dehydrateWorkspace, hydrateWorkspace, loadWorkspace, persistWorkspace } from './workspaceIO';

export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error';
let initialization: Promise<Workspace> | undefined;
async function initialize(): Promise<Workspace> {
  if (initialization) return initialization;
  const operation = (async () => {
    const saved = await loadWorkspace();
    if (saved) return saved;
    const snapshot = captureLegacySnapshot(localStorage);
    const workspace = LEGACY_KEYS.some((key) => snapshot.keys[key] !== null) ? await migrateLegacy(snapshot) : createWorkspace();
    const verification = new AssetManager();
    try {
      const checked = await hydrateWorkspace(workspace, verification);
      const stable = dehydrateWorkspace(checked.workspace, verification);
      await persistWorkspace(stable, verification);
      return stable;
    } finally {
      verification.dispose();
    }
  })();
  initialization = operation;
  try {
    return await operation;
  } finally {
    if (initialization === operation) initialization = undefined;
  }
}
export function useWorkspace() {
  const [history, setHistory] = useState<History<Workspace> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const historyRef = useRef<History<Workspace> | null>(null);
  const managerRef = useRef<AssetManager>(new AssetManager());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const mounted = useRef(true);
  const updateWorkspace = useCallback((fn: (workspace: Workspace) => Workspace): void => {
    const previous = historyRef.current;
    if (!previous) return;
    const next = commitHistory(previous, fn(previous.present));
    if (next === previous) return;
    historyRef.current = next;
    revision.current++;
    setHistory(next);
    setSaveStatus('saving');
  }, []);
  const flush = useCallback(async (): Promise<void> => {
    const current = historyRef.current;
    if (!current || revision.current === savedRevision.current) return;
    const snapshot = dehydrateWorkspace(current.present, managerRef.current);
    const capturedRevision = revision.current;
    if (mounted.current) setSaveStatus('saving');
    const operation = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await persistWorkspace(snapshot, managerRef.current);
        savedRevision.current = capturedRevision;
        if (mounted.current) setSaveStatus(revision.current === capturedRevision ? 'saved' : 'saving');
      });
    saveQueue.current = operation;
    try {
      await operation;
    } catch (failure) {
      if (mounted.current) {
        setSaveStatus('error');
        setError(`Não foi possível salvar: ${String(failure)}. Seus dados em memória continuam disponíveis; exporte um backup.`);
      }
      throw failure;
    }
  }, []);
  useEffect(() => {
    let canceled = false;
    mounted.current = true;
    const manager = new AssetManager();
    managerRef.current = manager;
    void (async () => {
      try {
        const stable = await initialize();
        if (canceled) return;
        const hydrated = await hydrateWorkspace(stable, manager);
        if (canceled) return;
        if (JSON.stringify(stable) !== JSON.stringify(dehydrateWorkspace(hydrated.workspace, manager))) {
          await persistWorkspace(hydrated.workspace, manager);
          if (canceled) return;
        }
        const initial = createHistory(hydrated.workspace);
        historyRef.current = initial;
        setHistory(initial);
        setWarnings([...(stable.migration?.warnings ?? []), ...hydrated.warnings]);
        setSaveStatus('saved');
      } catch (failure) {
        if (!canceled) {
          setError(String(failure));
          setSaveStatus('error');
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (revision.current !== savedRevision.current) {
        void flush().catch(() => undefined);
        event.preventDefault();
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') void flush().catch(() => undefined);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      canceled = true;
      mounted.current = false;
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', visibility);
      void flush()
        .catch(() => undefined)
        .finally(() => manager.dispose());
    };
  }, [flush]);
  useEffect(() => {
    if (!history || revision.current === savedRevision.current) return;
    const timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [history, flush]);
  useEffect(() => {
    if (!history) return;
    const liveAssets = new Set(
      [...history.past, history.present, ...history.future].flatMap((workspace) =>
        workspace.profiles.flatMap((profile) => profile.assets.map((asset) => asset.id)),
      ),
    );
    managerRef.current.releaseUnused(liveAssets);
  }, [history]);
  const navigateHistory = (direction: 'undo' | 'redo') => {
    const current = historyRef.current;
    if (!current) return;
    const next = direction === 'undo' ? undoHistory(current) : redoHistory(current);
    if (next !== current) {
      historyRef.current = next;
      revision.current++;
      setHistory(next);
      setSaveStatus('saving');
    }
  };
  const workspace = history?.present ?? null;
  const profile = workspace?.profiles.find((profile) => profile.id === workspace.activeProfileId) ?? null;
  const project = workspace?.projects.find((project) => project.id === workspace.activeProjectByProfile[profile?.id ?? '']) ?? null;
  const context = {
    get: () => historyRef.current?.present ?? null,
    update: updateWorkspace,
    manager: () => managerRef.current,
    warn: (next: string[]) => {
      if (next.length) setWarnings((previous) => [...previous, ...next]);
    },
  };
  return {
    workspace,
    profile,
    project,
    loading,
    error,
    warnings,
    saveStatus,
    canUndo: Boolean(history?.past.length),
    canRedo: Boolean(history?.future.length),
    clearError: () => setError(null),
    clearWarnings: () => setWarnings([]),
    updateWorkspace,
    updateProject: (fn: (project: Project) => Project): void =>
      updateWorkspace((current) => {
        const id = current.activeProjectByProfile[current.activeProfileId ?? ''];
        return {
          ...current,
          projects: current.projects.map((project) => (project.id === id ? { ...fn(project), updatedAt: isoNow() } : project)),
        };
      }),
    ...profileActions(context),
    ...mediaActions(context),
    flush,
    undo: () => navigateHistory('undo'),
    redo: () => navigateHistory('redo'),
  };
}
