import { copyFraming } from './batch';
import type { MediaItem } from './models';
export type Adjustment = 'framing' | 'layers' | 'trim' | 'speed' | 'background';
export function duplicateMedia(item: MediaItem): MediaItem {
  return { ...structuredClone(item), id: crypto.randomUUID(), title: `${item.title} (cópia)` };
}
export function splitMedia(item: MediaItem, at: number): [MediaItem, MediaItem] {
  if (item.kind !== 'video' || item.status !== 'ready') throw new Error('Selecione um vídeo disponível.');
  const frame = 1 / (item.probe?.fps || 30);
  const split = Math.round(at / frame) * frame;
  if (!Number.isFinite(split) || split < item.trim.in + frame || split > item.trim.out - frame)
    throw new Error('Posicione o cursor dentro do trecho, deixando ao menos um quadro em cada parte.');
  const offset = (split - item.trim.in) / item.speed;
  const left = structuredClone(item),
    right = duplicateMedia(item);
  left.trim.out = split;
  right.title = `${item.title} · parte 2`;
  right.trim.in = split;
  left.render.layers = left.render.layers
    .map((layer) => (layer.enable ? { ...layer, enable: { start: layer.enable.start, end: Math.min(offset, layer.enable.end) } } : layer))
    .filter((layer) => !layer.enable || layer.enable.end > layer.enable.start);
  right.render.layers = right.render.layers
    .map((layer) =>
      layer.enable ? { ...layer, enable: { start: Math.max(0, layer.enable.start - offset), end: layer.enable.end - offset } } : layer,
    )
    .filter((layer) => !layer.enable || layer.enable.end > layer.enable.start);
  return [left, right];
}
export function copyAdjustments(source: MediaItem, target: MediaItem, groups: Adjustment[]): MediaItem {
  let result = structuredClone(target);
  if (groups.includes('framing')) result = copyFraming(source, result, true);
  if (groups.includes('background')) result.render.background = structuredClone(source.render.background);
  if (groups.includes('layers')) {
    result.render.layers = structuredClone(source.render.layers);
    result.templates = { ...source.templates };
    result.headlineText = source.headlineText;
  }
  if (groups.includes('speed') && source.kind === 'video' && result.kind === 'video') result.speed = source.speed;
  if (groups.includes('trim') && source.kind === 'video' && result.kind === 'video') {
    const duration = result.probe?.duration || result.trim.out;
    const frame = 1 / (result.probe?.fps || 30);
    const end = Math.min(duration, source.trim.out);
    result.trim = { in: Math.max(0, Math.min(source.trim.in, end - frame)), out: end };
  }
  return result;
}
export const renumberMedia = (items: MediaItem[]) => items.map((item, index) => ({ ...item, slot: index + 1 }));
