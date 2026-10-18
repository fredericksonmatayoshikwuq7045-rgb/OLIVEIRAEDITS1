import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { MediaItem } from '../domain/models';
import { cropSelectionGeometry, cropSourceDelta } from '../render/crop';
import { snapMediaPan, snapRect } from '../render/snap';
import { RenderCanvas } from '../render/RenderCanvas';
import { BACKGROUND_TRACK } from '../domain/timeline';
import type { Rect } from '../render/types';
import { mediaUrl } from '../services/native';
import { TransformBox } from './TransformBox';
import { hitLayer } from '../render/transform';
import { createRenderSpec } from '../render/types';
import { CropOverlay } from './CropOverlay';
import { StageEmpty } from './StageEmpty';
import type { Drag, StageProps } from './stageTypes';
import { usePinch } from './usePinch';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function Stage({
  item,
  compare = false,
  onContextMenu,
  onSelectLayer,
  onChange,
  playing,
  time,
  onTime,
  onEnded,
  cropMode,
  cropLocked,
  guides,
  safeZone,
  activeLayerId,
  onImport,
  onImportFolder,
  importing,
  resolveSource,
  notify,
  onDropFiles,
}: StageProps) {
  const [draft, setDraft] = useState<MediaItem | null>(item);
  const [size, setSize] = useState({ width: 500, height: 500 });
  const area = useRef<HTMLDivElement>(null),
    preview = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    latest = useRef(item),
    wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!drag.current && !wheelTimer.current) {
      setDraft(item);
      latest.current = item;
    }
  }, [item]);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth - 48, height: element.clientHeight - 48 }));
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, []);
  const commit = useCallback(() => {
    if (drag.current && latest.current && latest.current !== drag.current.item) onChange(latest.current);
    drag.current = null;
  }, [onChange]);
  const changeDraft = (value: MediaItem) => {
    latest.current = value;
    setDraft(value);
  };
  const pinch = usePinch(draft, changeDraft, onChange);
  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!pinch.end(event)) commit();
  };
  const start = (event: PointerEvent<HTMLDivElement | HTMLButtonElement>, handle?: string) => {
    if (compare || !draft || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    let selectedLayer = activeLayerId;
    if (onSelectLayer && !handle && !cropMode && preview.current) {
      const bounds = preview.current.getBoundingClientRect();
      selectedLayer = hitLayer(
        draft,
        {
          x: ((event.clientX - bounds.left) / bounds.width) * draft.render.canvas.width,
          y: ((event.clientY - bounds.top) / bounds.height) * draft.render.canvas.height,
        },
        Math.max(0, (time - draft.trim.in) / draft.speed),
      );
      onSelectLayer(selectedLayer);
    }
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      item: draft,
      handle,
      layerId: !handle && !cropMode ? selectedLayer || undefined : undefined,
    };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current,
      element = preview.current;
    if (!state || !element) return;
    const dx = (event.clientX - state.x) / element.clientWidth,
      dy = (event.clientY - state.y) / element.clientHeight;
    const media = state.item.render.media;
    if (state.layerId) {
      changeDraft({
        ...state.item,
        render: {
          ...state.item.render,
          layers: state.item.render.layers.map((layer) =>
            layer.id === state.layerId
              ? { ...layer, rect: snapRect({ ...layer.rect, x: layer.rect.x + dx, y: layer.rect.y + dy }) }
              : layer,
          ),
        },
      });
      return;
    }
    if (state.handle) {
      const delta = cropSourceDelta(state.item.render, { x: dx * state.item.render.canvas.width, y: dy * state.item.render.canvas.height });
      const cx = delta.x,
        cy = delta.y;
      const crop: Rect = { ...media.crop };
      if (state.handle.includes('w')) {
        crop.x = clamp(media.crop.x + cx, 0, media.crop.x + media.crop.width - 0.02);
        crop.width = media.crop.width + media.crop.x - crop.x;
      }
      if (state.handle.includes('e')) crop.width = clamp(media.crop.width + cx, 0.02, 1 - crop.x);
      if (state.handle.includes('n')) {
        crop.y = clamp(media.crop.y + cy, 0, media.crop.y + media.crop.height - 0.02);
        crop.height = media.crop.height + media.crop.y - crop.y;
      }
      if (state.handle.includes('s')) crop.height = clamp(media.crop.height + cy, 0.02, 1 - crop.y);
      if (cropLocked) {
        const ratio = ((state.item.render.canvas.width / state.item.render.canvas.height) * media.height) / media.width;
        if (state.handle.includes('e') || state.handle.includes('w')) crop.height = Math.min(crop.width / ratio, 1 - crop.y);
        else crop.width = Math.min(crop.height * ratio, 1 - crop.x);
      }
      changeDraft({ ...state.item, render: { ...state.item.render, media: { ...media, crop } } });
      return;
    }
    if (cropMode) {
      const delta = cropSourceDelta(state.item.render, { x: dx * state.item.render.canvas.width, y: dy * state.item.render.canvas.height });
      changeDraft({
        ...state.item,
        render: {
          ...state.item.render,
          media: {
            ...media,
            crop: {
              ...media.crop,
              x: clamp(media.crop.x + delta.x, 0, 1 - media.crop.width),
              y: clamp(media.crop.y + delta.y, 0, 1 - media.crop.height),
            },
          },
        },
      });
      return;
    }
    changeDraft({
      ...state.item,
      render: {
        ...state.item.render,
        media: { ...media, pan: snapMediaPan(state.item.render, { x: media.pan.x + dx, y: media.pan.y + dy }) },
      },
    });
  };
  const source = draft && (draft.runtimeUrl || draft.render.media.source || draft.sourcePath);
  const valid = draft && source && draft.status !== 'missing' && draft.status !== 'empty' && draft.status !== 'error';
  const scale = draft ? Math.max(0.01, Math.min(size.width / draft.render.canvas.width, size.height / draft.render.canvas.height)) : 1;
  const original = draft
    ? createRenderSpec(draft.render.canvas.width, draft.render.canvas.height, draft.runtimeUrl || draft.render.media.source, draft.kind)
    : null;
  if (original && draft) {
    original.media.width = draft.render.media.width;
    original.media.height = draft.render.media.height;
  }
  const cropSelection = valid ? cropSelectionGeometry(draft.render) : null;
  const rect = cropSelection?.rect;
  return (
    <div
      className="stage-area"
      onContextMenu={onContextMenu}
      ref={area}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        onDropFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {valid ? (
        <div
          ref={preview}
          className="stage-preview"
          tabIndex={0}
          aria-label="Prévia de edição. Arraste para mover a mídia"
          style={{ width: draft.render.canvas.width * scale, height: draft.render.canvas.height * scale }}
          onPointerDownCapture={(e) => {
            if (compare || (e.target as HTMLElement).closest('.transform-handle')) return;
            if (pinch.start(e)) {
              drag.current = null;
              e.stopPropagation();
            }
          }}
          onPointerDown={(e) => start(e)}
          onPointerMove={(e) => {
            if (!pinch.move(e)) move(e);
          }}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onWheel={(e) => {
            if (compare) return;
            e.preventDefault();
            const current = latest.current || draft;
            const next = {
              ...current,
              render: {
                ...current.render,
                media: { ...current.render.media, zoom: clamp(current.render.media.zoom * (e.deltaY > 0 ? 0.95 : 1.05), 0.1, 5) },
              },
            };
            changeDraft(next);
            if (wheelTimer.current) clearTimeout(wheelTimer.current);
            wheelTimer.current = setTimeout(() => {
              wheelTimer.current = undefined;
              onChange(next);
            }, 180);
          }}
          onKeyDown={(e) => {
            if (compare || e.ctrlKey || e.metaKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();
            const pixels = e.shiftKey ? 10 : 1;
            const pan = { ...draft.render.media.pan };
            if (e.key === 'ArrowLeft') pan.x -= pixels / draft.render.canvas.width;
            if (e.key === 'ArrowRight') pan.x += pixels / draft.render.canvas.width;
            if (e.key === 'ArrowUp') pan.y -= pixels / draft.render.canvas.height;
            if (e.key === 'ArrowDown') pan.y += pixels / draft.render.canvas.height;
            onChange({ ...draft, render: { ...draft.render, media: { ...draft.render.media, pan } } });
          }}
        >
          <RenderCanvas
            spec={
              compare && original
                ? original
                : {
                    ...(cropMode && cropSelection ? cropSelection.previewSpec : draft.render),
                    media: {
                      ...(cropMode && cropSelection ? cropSelection.previewSpec.media : draft.render.media),
                      source: draft.runtimeUrl || draft.render.media.source,
                    },
                  }
            }
            playbackRate={draft.kind === 'video' ? draft.speed : 1}
            timeOrigin={draft.kind === 'video' ? draft.trim.in : 0}
            playing={playing}
            time={time}
            onTimeUpdate={onTime}
            onEnded={onEnded}
            onError={notify}
            resolveSource={(sourcePath) =>
              sourcePath.startsWith('blob:') || sourcePath.startsWith('data:')
                ? sourcePath
                : resolveSource(sourcePath) || mediaUrl(sourcePath)
            }
          />
          <div className={`stage-overlay ${guides ? 'stage-guides' : ''}`}>
            {safeZone && (
              <div className="safe-zone">
                <span>Área segura</span>
              </div>
            )}
          </div>
          {!cropMode && !compare && activeLayerId !== BACKGROUND_TRACK && (
            <TransformBox item={draft} layerId={activeLayerId} onDraft={changeDraft} onCommit={onChange} />
          )}
          {cropMode && !compare && rect && <CropOverlay item={draft} rect={rect} onStart={start} />}
        </div>
      ) : (
        <StageEmpty item={draft} onImport={onImport} onImportFolder={onImportFolder} importing={importing} />
      )}
      {valid && (
        <span className="stage-caption">
          {draft.render.canvas.width} × {draft.render.canvas.height} · {Math.round(scale * 100)}% · Arraste para mover
        </span>
      )}
    </div>
  );
}
