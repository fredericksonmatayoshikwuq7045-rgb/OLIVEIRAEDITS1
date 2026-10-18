import type { MediaItem } from '../domain/models';
import { MEDIA_TRACK } from '../domain/timeline';
import type { RenderLayer, RenderMedia } from '../render/types';
import { NumberCommit } from './NumberCommit';
import { Button } from './Primitives';
export function TrackGeometry({ item, id, onChange }: { item: MediaItem; id: string; onChange: (item: MediaItem) => void }) {
  const layer = item.render.layers.find((value) => value.id === id),
    media = item.render.media;
  const patchLayer = (change: Partial<RenderLayer>) =>
    onChange({
      ...item,
      render: {
        ...item.render,
        layers: item.render.layers.map((value) => (value.id === id ? ({ ...value, ...change } as RenderLayer) : value)),
      },
    });
  const patchMedia = (change: Partial<RenderMedia>) => onChange({ ...item, render: { ...item.render, media: { ...media, ...change } } });
  if (id === MEDIA_TRACK)
    return (
      <div className="timeline-geometry">
        <NumberCommit
          label="Zoom da mídia (%)"
          value={media.zoom * 100}
          min={10}
          max={500}
          onCommit={(zoom) => patchMedia({ zoom: zoom / 100 })}
        />
        <NumberCommit
          label="Posição X (%)"
          value={media.pan.x * 100}
          min={-200}
          max={200}
          onCommit={(x) => patchMedia({ pan: { ...media.pan, x: x / 100 } })}
        />
        <NumberCommit
          label="Posição Y (%)"
          value={media.pan.y * 100}
          min={-200}
          max={200}
          onCommit={(y) => patchMedia({ pan: { ...media.pan, y: y / 100 } })}
        />
        <Button onClick={() => patchMedia({ fit: 'cover', zoom: 1, pan: { x: 0, y: 0 } })}>Preencher tela</Button>
      </div>
    );
  if (!layer) return null;
  return (
    <div className="timeline-geometry" aria-label="Transformação da camada">
      {(['x', 'y', 'width', 'height'] as const)
        .filter((key) => layer.type !== 'text' || key !== 'height')
        .map((key) => (
          <NumberCommit
            key={key}
            label={`${{ x: 'Posição X', y: 'Posição Y', width: 'Largura', height: 'Altura' }[key]} (%)`}
            value={layer.rect[key] * 100}
            min={key === 'width' || key === 'height' ? 0.5 : -200}
            max={key === 'width' || key === 'height' ? 800 : 200}
            onCommit={(value) => patchLayer({ rect: { ...layer.rect, [key]: value / 100 } })}
          />
        ))}
      {layer.type === 'text' && (
        <NumberCommit
          label="Fonte (px)"
          value={layer.fontSize * item.render.canvas.height}
          min={8}
          max={800}
          onCommit={(value) => patchLayer({ fontSize: value / item.render.canvas.height })}
        />
      )}
      <NumberCommit label="Rotação (°)" value={layer.rotation} min={-360} max={360} onCommit={(rotation) => patchLayer({ rotation })} />
      <NumberCommit
        label="Opacidade (%)"
        value={layer.opacity * 100}
        max={100}
        onCommit={(opacity) => patchLayer({ opacity: opacity / 100 })}
      />
      {layer.type !== 'text' && (
        <Button onClick={() => patchLayer({ rect: { x: 0, y: 0, width: 1, height: 1 }, fit: 'cover' })}>Preencher tela</Button>
      )}
    </div>
  );
}
