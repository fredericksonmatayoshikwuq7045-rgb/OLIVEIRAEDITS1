import type { Rect } from '../render/types';
import type { PixelFrame } from './pixels';
export interface ContentDetection {
  rect: Rect;
  confidence: number;
}
function longestRun(active: boolean[]): [number, number] {
  // Close tiny dark gaps within the scene, while keeping title bands separate.
  const gap = Math.max(1, Math.round(active.length * 0.012));
  let last = -1;
  for (let i = 0; i < active.length; i++)
    if (active[i]) {
      if (last >= 0 && i - last <= gap) for (let j = last; j < i; j++) active[j] = true;
      last = i;
    }
  let best: [number, number] = [0, 0],
    start = 0;
  for (let i = 0; i <= active.length; i++) {
    if (active[i]) continue;
    if (i - start > best[1] - best[0]) best = [start, i];
    start = i + 1;
  }
  return best;
}
export function detectContent(frame: PixelFrame): ContentDetection | null {
  const { width, height, data } = frame;
  const bright = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return Math.max(data[i], data[i + 1], data[i + 2]) > 32;
  };
  const rows = Array.from({ length: height }, (_, y) => {
    let count = 0;
    for (let x = 0; x < width; x += 2) if (bright(x, y)) count++;
    return count / Math.ceil(width / 2);
  });
  const [top, bottom] = longestRun(rows.map((value) => value > 0.14));
  if (bottom - top < height * 0.18) return null;
  const columns = Array.from({ length: width }, (_, x) => {
    let count = 0;
    for (let y = top; y < bottom; y += 2) if (bright(x, y)) count++;
    return count / Math.ceil((bottom - top) / 2);
  });
  const [left, right] = longestRun(columns.map((value) => value > 0.14));
  if (right - left < width * 0.2) return null;
  const margin = 1,
    x = Math.max(0, left - margin),
    y = Math.max(0, top - margin),
    r = Math.min(width, right + margin),
    b = Math.min(height, bottom + margin);
  const strength = rows.slice(top, bottom).reduce((a, v) => a + v, 0) / (bottom - top);
  const changed = top > height * 0.02 || bottom < height * 0.98 || left > width * 0.02 || right < width * 0.98;
  return {
    rect: { x: x / width, y: y / height, width: (r - x) / width, height: (b - y) / height },
    confidence: changed ? Math.min(0.98, 0.65 + strength * 0.35) : 0.5,
  };
}
export function stableContent(detections: ContentDetection[]): ContentDetection | null {
  if (!detections.length) return null;
  const x = Math.min(...detections.map((d) => d.rect.x)),
    y = Math.min(...detections.map((d) => d.rect.y));
  const right = Math.max(...detections.map((d) => d.rect.x + d.rect.width)),
    bottom = Math.max(...detections.map((d) => d.rect.y + d.rect.height));
  const union = { x, y, width: right - x, height: bottom - y };
  const agreement = Math.min(...detections.map((d) => (d.rect.width * d.rect.height) / (union.width * union.height)));
  return { rect: union, confidence: Math.min(...detections.map((d) => d.confidence)) * agreement };
}
