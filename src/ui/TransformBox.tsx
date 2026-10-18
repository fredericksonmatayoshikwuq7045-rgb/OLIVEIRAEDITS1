import { useRef, type PointerEvent } from 'react';
import type { MediaItem } from '../domain/models';
import { selectionRect, transformSelection } from '../render/transform';
export function TransformBox({
  item,
  layerId,
  onDraft,
  onCommit,
}: {
  item: MediaItem;
  layerId: string | null;
  onDraft: (item: MediaItem) => void;
  onCommit: (item: MediaItem) => void;
}) {
  const drag = useRef<{
    item: MediaItem;
    handle: string;
    x: number;
    y: number;
    width: number;
    height: number;
    left: number;
    top: number;
  } | null>(null);
  const latest = useRef(item);
  latest.current = item;
  const rect = selectionRect(item, layerId),
    canvas = item.render.canvas;
  const start = (event: PointerEvent<HTMLButtonElement>, handle: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const preview = event.currentTarget.closest('.stage-preview')!.getBoundingClientRect();
    drag.current = {
      item,
      handle,
      x: event.clientX,
      y: event.clientY,
      width: preview.width,
      height: preview.height,
      left: preview.left,
      top: preview.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  return (
    <div
      className="transform-box"
      style={{
        left: `${(rect.x / canvas.width) * 100}%`,
        top: `${(rect.y / canvas.height) * 100}%`,
        width: `${(rect.width / canvas.width) * 100}%`,
        height: `${(rect.height / canvas.height) * 100}%`,
        transform: `rotate(${rect.rotation}deg)`,
      }}
    >
      {(
        [
          ['nw', 0, 0],
          ['n', 50, 0],
          ['ne', 100, 0],
          ['e', 100, 50],
          ['se', 100, 100],
          ['s', 50, 100],
          ['sw', 0, 100],
          ['w', 0, 50],
          ['rotate', 50, -12],
        ] as const
      ).map(([handle, x, y]) => (
        <button
          key={handle}
          className={`transform-handle ${handle === 'rotate' ? 'rotation-handle' : ''}`}
          aria-label={handle === 'rotate' ? 'Girar seleção' : `Redimensionar seleção ${handle}`}
          style={{ left: `${x}%`, top: `${y}%`, cursor: handle === 'rotate' ? 'grab' : `${handle}-resize` }}
          onPointerDown={(event) => start(event, handle)}
          onPointerMove={(event) => {
            const state = drag.current;
            if (!state) return;
            event.stopPropagation();
            const point = (x: number, y: number) => ({
              x: ((x - state.left) / state.width) * canvas.width,
              y: ((y - state.top) / state.height) * canvas.height,
            });
            const next = transformSelection(
              state.item,
              layerId,
              state.handle,
              {
                x: ((event.clientX - state.x) / state.width) * canvas.width,
                y: ((event.clientY - state.y) / state.height) * canvas.height,
              },
              point(state.x, state.y),
              point(event.clientX, event.clientY),
            );
            latest.current = next;
            onDraft(next);
          }}
          onPointerUp={(event) => {
            if (drag.current) {
              event.stopPropagation();
              const changed = latest.current !== drag.current.item;
              drag.current = null;
              if (changed) onCommit(latest.current);
            }
          }}
          onPointerCancel={(event) => {
            if (drag.current) {
              event.stopPropagation();
              onDraft(drag.current.item);
              drag.current = null;
            }
          }}
        />
      ))}
    </div>
  );
}
