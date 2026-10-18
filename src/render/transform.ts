import type { MediaItem } from '../domain/models';
import { computeGeometry } from './geometry';
import { layoutText } from './text';
import type { Point, Rect } from './types';
import { mainRange } from '../domain/timeline';
import { activeAt } from './playback';
export function selectionRect(item: MediaItem, layerId: string | null): Rect & { rotation: number } {
  const layer = item.render.layers.find((value) => value.id === layerId);
  const canvas = item.render.canvas;
  const context = layer?.type === 'text' && typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  return layer
    ? {
        x: layer.rect.x * canvas.width,
        y: layer.rect.y * canvas.height,
        width: layer.rect.width * canvas.width,
        height: layer.type === 'text' && context ? layoutText(context, layer, canvas).height : layer.rect.height * canvas.height,
        rotation: layer.rotation,
      }
    : { ...computeGeometry(item.render).drawRect, rotation: item.render.media.rotation };
}
export function transformSelection(
  item: MediaItem,
  layerId: string | null,
  handle: string,
  delta: Point,
  start: Point,
  current: Point,
): MediaItem {
  const result = structuredClone(item),
    rect = selectionRect(item, layerId),
    canvas = item.render.canvas;
  const layer = result.render.layers.find((value) => value.id === layerId);
  const radians = (rect.rotation * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians);
  const dx = delta.x * cos + delta.y * sin,
    dy = -delta.x * sin + delta.y * cos;
  if (handle === 'rotate') {
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const rotation =
      rect.rotation +
      ((Math.atan2(current.y - center.y, current.x - center.x) - Math.atan2(start.y - center.y, start.x - center.x)) * 180) / Math.PI;
    if (layer) layer.rotation = rotation;
    else result.render.media.rotation = rotation;
  } else {
    const sx = handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0;
    const sy = handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0;
    const factor = Math.max(
      0.1,
      Math.min(
        10,
        1 + (sx && sy ? ((sx * dx) / rect.width + (sy * dy) / rect.height) / 2 : sx ? (sx * dx) / rect.width : (sy * dy) / rect.height),
      ),
    );
    const applied = layer ? factor : Math.max(0.1, Math.min(5, item.render.media.zoom * factor)) / item.render.media.zoom;
    const width = rect.width * applied,
      height = rect.height * applied;
    const localX = (sx * (width - rect.width)) / 2,
      localY = (sy * (height - rect.height)) / 2;
    const shiftX = localX * cos - localY * sin,
      shiftY = localX * sin + localY * cos;
    if (layer)
      layer.rect = {
        x: (rect.x + rect.width / 2 + shiftX - width / 2) / canvas.width,
        y: (rect.y + rect.height / 2 + shiftY - height / 2) / canvas.height,
        width: width / canvas.width,
        height: height / canvas.height,
      };
    if (layer?.type === 'text') {
      layer.fontSize *= applied;
      layer.background = { ...layer.background, padding: layer.background.padding * applied, radius: layer.background.radius * applied };
      layer.stroke = { ...layer.stroke, width: layer.stroke.width * applied };
    }
    if (!layer) {
      result.render.media.zoom *= applied;
      result.render.media.pan.x += shiftX / canvas.width;
      result.render.media.pan.y += shiftY / canvas.height;
    }
  }
  return result;
}

export function hitLayer(item: MediaItem, point: Point, elapsed: number): string | null {
  const main = selectionRect(item, null),
    angle = (-main.rotation * Math.PI) / 180;
  const dx = point.x - main.x - main.width / 2,
    dy = point.y - main.y - main.height / 2;
  const mainCovers =
    activeAt({ ...item.render.media, enable: mainRange(item) }, elapsed) &&
    item.render.media.opacity > 0.01 &&
    Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle)) <= main.width / 2 &&
    Math.abs(dx * Math.sin(angle) + dy * Math.cos(angle)) <= main.height / 2;
  for (const layer of [...item.render.layers].sort((a, b) => b.zIndex - a.zIndex)) {
    if (
      !layer.visible ||
      layer.opacity <= 0.01 ||
      (mainCovers && layer.zIndex < item.render.media.zIndex) ||
      (layer.enable && (elapsed < layer.enable.start || elapsed >= layer.enable.end))
    )
      continue;
    const rect = selectionRect(item, layer.id),
      angle = (-rect.rotation * Math.PI) / 180;
    const dx = point.x - rect.x - rect.width / 2,
      dy = point.y - rect.y - rect.height / 2;
    const x = dx * Math.cos(angle) - dy * Math.sin(angle),
      y = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(x) <= rect.width / 2 && Math.abs(y) <= rect.height / 2) return layer.id;
  }
  return null;
}
