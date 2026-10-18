import type { PointerEvent } from 'react';
import type { MediaItem } from '../domain/models';
import type { Rect } from '../render/types';
export function CropOverlay({
  item,
  rect,
  onStart,
}: {
  item: MediaItem;
  rect: Rect;
  onStart: (event: PointerEvent<HTMLDivElement | HTMLButtonElement>, handle?: string) => void;
}) {
  return (
    <div
      className="crop-box"
      style={{
        left: `${(rect.x / item.render.canvas.width) * 100}%`,
        top: `${(rect.y / item.render.canvas.height) * 100}%`,
        width: `${(rect.width / item.render.canvas.width) * 100}%`,
        height: `${(rect.height / item.render.canvas.height) * 100}%`,
        transform: `rotate(${item.render.media.rotation}deg) scaleX(${item.render.media.flipH ? -1 : 1}) scaleY(${item.render.media.flipV ? -1 : 1})`,
      }}
      onPointerDown={(event) => onStart(event)}
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
        ] as const
      ).map(([handle, x, y]) => (
        <button
          key={handle}
          className="crop-handle"
          title={`Ajustar recorte ${handle}`}
          aria-label={`Ajustar recorte ${handle}`}
          style={{ left: `${x}%`, top: `${y}%`, cursor: `${handle}-resize` }}
          onPointerDown={(event) => onStart(event, handle)}
        />
      ))}
    </div>
  );
}
