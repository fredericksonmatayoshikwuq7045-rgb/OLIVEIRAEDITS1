import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copyFraming, rangeSelection } from '../domain/batch';
import type { MediaItem, Profile, Project, TemplateCategory } from '../domain/models';
import { applyTemplate } from '../domain/templates';
import type { RenderTextLayer } from '../render/types';
import { mediaUrl, renderPreview } from '../services/native';
import type { WorkspaceStore } from './Dashboard';
import type { UiSettings } from './Settings';
import type { EngineState } from './useEngine';
import { useMediaImport } from './useMediaImport';
export function useEditor({
  store,
  engine,
  settings,
  onBack,
  notify,
}: {
  store: WorkspaceStore;
  engine: EngineState;
  settings: UiSettings;
  onBack: () => void;
  notify: (message: string) => void;
}) {
  const [step, setStep] = useState(1),
    [activeId, setActiveId] = useState<string | null>(null),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [layerId, setLayerId] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false),
    [cropLocked, setCropLocked] = useState(true),
    [guides, setGuides] = useState(false),
    [safeZone, setSafeZone] = useState(false);
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [batch, setBatch] = useState(false),
    [exporting, setExporting] = useState(false),
    [metadata, setMetadata] = useState(false),
    [preview, setPreview] = useState<string | null>(null),
    [previewBusy, setPreviewBusy] = useState(false);
  const [saveName, setSaveName] = useState(''),
    [saving, setSaving] = useState<'preset' | 'style' | null>(null),
    [pendingStyle, setPendingStyle] = useState<RenderTextLayer | null>(null);
  const anchor = useRef<string | null>(null),
    relinkInput = useRef<HTMLInputElement>(null);
  const profile = store.profile,
    project = store.project;
  const items = useMemo(() => project?.items.filter((item) => item.status !== 'empty') || [], [project?.items]);
  const active = items.find((item) => item.id === activeId) || items[0] || null;
  const selected = items.filter((item) => selectedIds.includes(item.id));
  useEffect(() => {
    if (active && active.id !== activeId) {
      setActiveId(active.id);
      setSelectedIds([active.id]);
    }
  }, [active, activeId]);
  useEffect(() => {
    setPlaying(false);
    setTime(active?.trim.in || 0);
    setLayerId(null);
  }, [active?.id, active?.trim.in]);
  const changeItem = useCallback(
    (updated: MediaItem) => store.updateProject((p) => ({ ...p, items: p.items.map((item) => (item.id === updated.id ? updated : item)) })),
    [store],
  );
  const { importing, importProgress, importFiles, importMedia } = useMediaImport(store, notify);
  const select = useCallback(
    (item: MediaItem, ctrl: boolean, shift: boolean) => {
      setActiveId(item.id);
      if (shift && anchor.current)
        setSelectedIds(
          rangeSelection(
            items.map((i) => i.id),
            anchor.current,
            item.id,
          ),
        );
      else if (ctrl) setSelectedIds((ids) => (ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id]));
      else setSelectedIds([item.id]);
      if (!shift) anchor.current = item.id;
    },
    [items],
  );
  const applyUpdated = (updated: MediaItem[]) => {
    const lookup = new Map(updated.map((item) => [item.id, item]));
    store.updateProject((p) => ({ ...p, items: p.items.map((item) => lookup.get(item.id) || item) }));
    notify(`Alterações aplicadas a ${updated.length} mídias.`);
  };
  const applyFraming = (target: 'all' | 'selected') => {
    if (active) applyUpdated((target === 'all' ? items : selected).map((item) => copyFraming(active, item, true)));
  };
  const onTemplate = (id: string | null, category: TemplateCategory) => {
    if (active && profile) changeItem(applyTemplate(active, profile.templates.find((t) => t.id === id) || null, category));
  };
  const openExport = (cleanOnly = false) => {
    setMetadata(cleanOnly);
    setExporting(true);
    setStep(4);
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const element = event.target;
      if (
        element instanceof HTMLElement &&
        (element.closest('input,textarea,select,[contenteditable="true"]') || element.closest('[role="dialog"]'))
      )
        return;
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      } else if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(items.map((item) => item.id));
      } else if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        openExport();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const index = Math.max(
          0,
          items.findIndex((item) => item.id === active?.id),
        );
        const item = items[Math.min(items.length - 1, Math.max(0, index + (event.key === 'ArrowRight' ? 1 : -1)))];
        if (item) select(item, false, false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, active?.id, store, select]);
  const resolveSource = (source: string) => {
    const asset = profile?.assets.find((asset) => asset.source === source || asset.relativePath === source);
    const item = items.find((item) => item.sourcePath === source || item.render.media.source === source);
    return asset?.runtimeUrl || item?.runtimeUrl || mediaUrl(source);
  };
  const playTime = (seconds: number) => {
    if (active && seconds >= active.trim.out) {
      setPlaying(false);
      setTime(active.trim.in);
    } else setTime(seconds);
  };
  const nativePreview = async (frame = false) => {
    if (!active || !profile) return;
    setPreviewBusy(true);
    try {
      setPreview(await renderPreview(active, profile, { frame, seconds: frame ? undefined : 4 }));
    } catch (error) {
      notify(String(error));
    } finally {
      setPreviewBusy(false);
    }
  };
  return {
    store,
    engine,
    settings,
    onBack,
    notify,
    step,
    setStep,
    activeId,
    setActiveId,
    selectedIds,
    setSelectedIds,
    layerId,
    setLayerId,
    cropMode,
    setCropMode,
    cropLocked,
    setCropLocked,
    guides,
    setGuides,
    safeZone,
    setSafeZone,
    playing,
    setPlaying,
    time,
    setTime,
    batch,
    setBatch,
    exporting,
    setExporting,
    metadata,
    setMetadata,
    importing,
    importProgress,
    preview,
    setPreview,
    previewBusy,
    setPreviewBusy,
    saveName,
    setSaveName,
    saving,
    setSaving,
    pendingStyle,
    setPendingStyle,
    anchor,
    relinkInput,
    profile,
    project,
    items,
    active,
    selected,
    changeItem,
    importFiles,
    importMedia,
    select,
    applyUpdated,
    applyFraming,
    onTemplate,
    openExport,
    resolveSource,
    playTime,
    nativePreview,
  };
}
export type EditorProps = Parameters<typeof useEditor>[0];
export type EditorContext = ReturnType<typeof useEditor> & { profile: Profile; project: Project };
