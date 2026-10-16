import { computeGeometry } from './geometry';
import type { Point, Rect, RenderSpec } from './types';

function offset(start: number, length: number, total = 1): number {
  const distances = [-start, total / 2 - start - length / 2, total - start - length];
  const closest = distances.reduce((best, value) => (Math.abs(value) < Math.abs(best) ? value : best));
  return Math.abs(closest) <= total * 0.007 ? closest : 0;
}

/** Snap corresponding edges and centers; dimensions remain unchanged. */
export function snapRect(rect: Rect): Rect {
  return { ...rect, x: rect.x + offset(rect.x, rect.width), y: rect.y + offset(rect.y, rect.height) };
}

export function snapMediaPan(spec: RenderSpec, pan: Point): Point {
  const bounds = computeGeometry({ ...spec, media: { ...spec.media, pan } }).bounds;
  return {
    x: pan.x + offset(bounds.x, bounds.width, spec.canvas.width) / spec.canvas.width,
    y: pan.y + offset(bounds.y, bounds.height, spec.canvas.height) / spec.canvas.height,
  };
}
