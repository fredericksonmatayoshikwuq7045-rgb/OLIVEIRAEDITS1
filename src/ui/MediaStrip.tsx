import { AlertTriangle, Check, Film, Image as ImageIcon } from 'lucide-react';
import { memo, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { MediaSort } from '../domain/batch';
import type { MediaItem } from '../domain/models';
import type { ItemState } from '../services/contracts';
import { timecode } from './Primitives';
import { MediaTools } from './MediaTools';
const CELL = 115;
const Card = memo(function Card({
  item,
  active,
  selected,
  exportState,
  onSelect,
  onContextMenu,
}: {
  item: MediaItem;
  active: boolean;
  selected: boolean;
  exportState?: ItemState;
  onSelect: (item: MediaItem, ctrl: boolean, shift: boolean) => void;
  onContextMenu?: (event: MouseEvent, item: MediaItem) => void;
}) {
  const warning =
    item.status === 'missing' ||
    item.status === 'error' ||
    (item.probe && !item.probe.hasAudio && item.kind === 'video') ||
    (item.probe && item.probe.width < 720);
  return (
    <div
      role="option"
      onContextMenu={(event) => onContextMenu?.(event, item)}
      tabIndex={0}
      aria-selected={selected}
      title={`${item.title}${item.error ? ` — ${item.error}` : ''}`}
      className={`media-slot ${active ? 'active' : ''} ${selected ? 'selected' : ''}`}
      style={{ left: 0 }}
      onClick={(e) => onSelect(item, e.ctrlKey || e.metaKey, e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item, e.ctrlKey || e.metaKey, e.shiftKey);
        }
      }}
    >
      {item.thumbnailUrl || (item.kind === 'image' && item.runtimeUrl) ? (
        <img src={item.thumbnailUrl || item.runtimeUrl} alt="" draggable={false} />
      ) : (
        <div className="media-slot-placeholder">{item.kind === 'video' ? <Film size={23} /> : <ImageIcon size={23} />}</div>
      )}
      <span className="media-slot-index">{item.slot.toString().padStart(2, '0')}</span>
      <span className="media-slot-check">{selected && <Check size={11} />}</span>
      {warning && (
        <span
          className="media-slot-warning"
          title={item.error || (item.status === 'missing' ? 'Arquivo ausente. Re-vincule esta mídia.' : 'Verifique áudio e resolução.')}
        >
          <AlertTriangle size={13} />
        </span>
      )}
      {exportState && (
        <span className="media-export-state" title={exportState.error || undefined}>
          {
            { pending: 'Pendente', processing: 'Exportando', ok: 'Exportado', error: 'Falha', cancelled: 'Cancelado', skipped: 'Pulado' }[
              exportState.status
            ]
          }
          {exportState.status === 'processing' ? ` ${Math.round(exportState.progress.percent)}%` : ''}
        </span>
      )}
      <div className="media-slot-name">
        <div className="truncate">{item.title}</div>
        <small style={{ fontSize: 8 }}>
          {item.status === 'missing'
            ? 'Arquivo ausente'
            : item.status === 'empty'
              ? 'Vazio'
              : item.probe
                ? `${item.probe.width}×${item.probe.height}${item.kind === 'video' ? ` · ${timecode(item.trim.out - item.trim.in)}` : ''}`
                : item.status === 'error'
                  ? 'Erro de leitura'
                  : 'Pronto'}
        </small>
      </div>
    </div>
  );
});
export function MediaStrip({
  items,
  selectedIds,
  activeId,
  onSelect,
  onContextMenu,
  onImport,
  onImportFolder,
  onClear,
  clearingDisabled = false,
  clearCount = items.length,
  kind = 'all',
  importing,
  onSelectAll,
  onSelectUnedited,
  onSelectErrors,
  children,
  exportStates = {},
  onSort,
  grid = false,
}: {
  items: MediaItem[];
  grid?: boolean;
  exportStates?: Record<string, ItemState>;
  selectedIds: string[];
  activeId: string | null;
  onSelect: (item: MediaItem, ctrl: boolean, shift: boolean) => void;
  onContextMenu?: (event: MouseEvent, item: MediaItem) => void;
  onImport: () => void;
  onImportFolder: () => void;
  onClear: () => void;
  clearingDisabled?: boolean;
  clearCount?: number;
  kind?: 'all' | 'video' | 'image';
  importing: boolean;
  onSort: (order: MediaSort) => void;
  onSelectAll: () => void;
  onSelectUnedited: () => void;
  onSelectErrors: () => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [viewport, setViewport] = useState({ left: 0, width: 1000, top: 0, height: 200 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const updateViewport = () =>
      setViewport({ left: element.scrollLeft, width: element.clientWidth, top: element.scrollTop, height: element.clientHeight });
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, grid]);
  useEffect(() => {
    const index = items.findIndex((item) => item.id === activeId);
    const element = ref.current;
    if (index < 0 || !element) return;
    if (grid) {
      const columns = Math.max(1, Math.floor(element.clientWidth / 110)),
        top = Math.floor(index / columns) * 145;
      if (top < element.scrollTop) element.scrollTop = top;
      else if (top + 145 > element.scrollTop + element.clientHeight) element.scrollTop = top + 145 - element.clientHeight;
    } else {
      const left = index * CELL;
      if (left < element.scrollLeft) element.scrollLeft = left;
      else if (left + CELL > element.scrollLeft + element.clientWidth) element.scrollLeft = left + CELL - element.clientWidth;
    }
    setViewport({ left: element.scrollLeft, width: element.clientWidth, top: element.scrollTop, height: element.clientHeight });
  }, [activeId, items, open, grid]);
  const columns = Math.max(1, Math.floor(viewport.width / 110));
  const first = grid ? Math.max(0, (Math.floor(viewport.top / 145) - 1) * columns) : Math.max(0, Math.floor(viewport.left / CELL) - 3),
    last = grid
      ? Math.min(items.length, (Math.ceil((viewport.top + viewport.height) / 145) + 1) * columns)
      : Math.min(items.length, Math.ceil((viewport.left + viewport.width) / CELL) + 3);
  return (
    <section className="media-strip" aria-label="Biblioteca de mídias">
      <MediaTools
        title={`${kind === 'image' ? 'Imagens do projeto' : kind === 'video' ? 'Vídeos do projeto' : 'Mídias do projeto'} (${items.filter((item) => item.status !== 'empty').length})`}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        importing={importing}
        onImport={onImport}
        onImportFolder={onImportFolder}
        onClear={onClear}
        clearDisabled={importing || clearingDisabled || !clearCount}
        onSort={onSort}
        onSelectAll={onSelectAll}
        onSelectUnedited={onSelectUnedited}
        onSelectErrors={onSelectErrors}
      />
      {children}
      {open && (
        <div
          ref={ref}
          className="media-scroll"
          role="listbox"
          aria-multiselectable="true"
          aria-label="Mídias importadas"
          onScroll={(e) =>
            setViewport({
              left: e.currentTarget.scrollLeft,
              width: e.currentTarget.clientWidth,
              top: e.currentTarget.scrollTop,
              height: e.currentTarget.clientHeight,
            })
          }
        >
          <div
            className="media-scroll-inner"
            style={
              grid
                ? { width: viewport.width, height: Math.max(viewport.height, Math.ceil(items.length / columns) * 145) }
                : { width: Math.max(items.length * CELL, viewport.width) }
            }
          >
            {items.slice(first, last).map((item, offset) => (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  left: grid ? ((first + offset) % columns) * 110 : (first + offset) * CELL,
                  top: grid ? Math.floor((first + offset) / columns) * 145 : 0,
                  width: 105,
                }}
              >
                <Card
                  item={item}
                  onContextMenu={onContextMenu}
                  exportState={exportStates[item.id]}
                  active={item.id === activeId}
                  selected={selectedIds.includes(item.id)}
                  onSelect={(_, ctrl, shift) => onSelect(item, ctrl, shift)}
                />
              </div>
            ))}
            {items.length === 0 && (
              <div className="muted" style={{ padding: '35px 20px', fontSize: 12 }}>
                Importe arquivos ou uma pasta para começar. O grid aceita mais de 500 mídias.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
