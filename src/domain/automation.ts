import type { MediaItem } from './models';
import { computeGeometry, sourceToCanvas } from '../render/geometry';
import { createTextLayer, type Rect, type RenderImageLayer } from '../render/types';
export interface MarkRule {
  mode: 'text' | 'image';
  targetText: string;
  referenceAssetId?: string;
  replacementText: string;
  replacementTemplateId?: string;
  color: string;
  margin: number;
}
export const defaultMarkRule: MarkRule = { mode: 'text', targetText: '', replacementText: '', color: '#111111', margin: 0.01 };
export function normalizeMarkRule(value?: Partial<MarkRule>): MarkRule {
  return {
    ...defaultMarkRule,
    mode: value?.mode === 'image' ? 'image' : 'text',
    targetText: typeof value?.targetText === 'string' ? value.targetText.slice(0, 200) : '',
    replacementText: typeof value?.replacementText === 'string' ? value.replacementText.slice(0, 200) : '',
    referenceAssetId: typeof value?.referenceAssetId === 'string' ? value.referenceAssetId : undefined,
    replacementTemplateId: typeof value?.replacementTemplateId === 'string' ? value.replacementTemplateId : undefined,
    color: typeof value?.color === 'string' && /^#[\da-f]{6}$/i.test(value.color) ? value.color : '#111111',
    margin: typeof value?.margin === 'number' && Number.isFinite(value.margin) ? Math.max(0, Math.min(0.05, value.margin)) : 0.01,
  };
}
export function canvasDetection(item: MediaItem, box: Rect, margin = 0.01): Rect {
  const geometry = computeGeometry(item.render),
    media = item.render.media,
    canvas = item.render.canvas;
  const points = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([x, y]) => sourceToCanvas(geometry, { x: x * media.width - geometry.sourceCrop.x, y: y * media.height - geometry.sourceCrop.y }));
  const x = Math.max(0, Math.min(...points.map((p) => p.x)) / canvas.width - margin),
    y = Math.max(0, Math.min(...points.map((p) => p.y)) / canvas.height - margin);
  const right = Math.min(1, Math.max(...points.map((p) => p.x)) / canvas.width + margin),
    bottom = Math.min(1, Math.max(...points.map((p) => p.y)) / canvas.height + margin);
  if (right <= x || bottom <= y) throw new Error('A marca detectada ficou fora do enquadramento. Ajuste o recorte primeiro.');
  return { x, y, width: right - x, height: bottom - y };
}
export function coverMark(
  item: MediaItem,
  box: Rect,
  rule: MarkRule,
  plateSource: string,
  logo?: { source: string; width: number; height: number },
): MediaItem {
  const rect = canvasDetection(item, box, rule.margin),
    prefix = 'auto-cover-',
    zIndex = Math.max(100, ...item.render.layers.map((layer) => layer.zIndex + 1));
  const plate: RenderImageLayer = {
    id: `${prefix}plate`,
    type: 'image',
    source: plateSource,
    sourceWidth: 1,
    sourceHeight: 1,
    fit: 'stretch',
    rect,
    rotation: 0,
    opacity: 1,
    visible: true,
    zIndex,
  };
  const fontSize = Math.max(
    0.006,
    Math.min(
      rect.height * 0.65,
      (rect.width * item.render.canvas.width) / item.render.canvas.height / Math.max(1, rule.replacementText.length * 0.65),
    ),
  );
  const layer = logo
    ? {
        ...plate,
        id: `${prefix}logo`,
        source: logo.source,
        sourceWidth: logo.width,
        sourceHeight: logo.height,
        fit: 'contain' as const,
        zIndex: zIndex + 1,
      }
    : {
        ...createTextLayer(`${prefix}text`),
        text: rule.replacementText,
        rect: { ...rect, y: rect.y + (rect.height - fontSize) / 2, height: fontSize },
        fontSize,
        background: { color: rule.color, opacity: 0, padding: 0, radius: 0 },
        lineHeight: 1,
        align: 'center' as const,
        zIndex: zIndex + 1,
      };
  return {
    ...item,
    render: { ...item.render, layers: [...item.render.layers.filter((value) => !value.id.startsWith(prefix)), plate, layer] },
  };
}
