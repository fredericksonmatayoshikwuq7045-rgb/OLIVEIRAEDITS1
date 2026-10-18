import type { MediaItem } from './models';
import { compositionDuration } from './timeline';
/** Splitting a layer leaves the composition intact and advances the right decoder's phase. */
export function splitLayer(item: MediaItem, id: string, at: number): MediaItem {
  const layer = item.render.layers.find((layer) => layer.id === id);
  if (!layer) return item;
  const start = layer.enable?.start || 0,
    end = layer.enable?.end || compositionDuration(item);
  if (!Number.isFinite(at) || at <= start || at >= end) return item;
  const right = {
    ...structuredClone(layer),
    id: `${layer.id.split(':part:')[0].split(':copy:')[0]}:part:${crypto.randomUUID()}`,
    enable: { start: at, end },
  };
  if (right.type === 'video') {
    const offset = (right.sourceOffset || 0) + at - start;
    right.sourceOffset = right.loop !== false && right.sourceDuration ? offset % right.sourceDuration : offset;
  }
  return {
    ...item,
    render: {
      ...item.render,
      layers: item.render.layers.flatMap((value) => (value.id === id ? [{ ...value, enable: { start, end: at } }, right] : [value])),
    },
  };
}
