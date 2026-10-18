import { copyFraming } from './batch';
import type { MediaItem } from './models';
import type { RenderBackground, Timing } from '../render/types';
import { mainRange } from './timeline';
function afterSplit<T extends Timing>(value: T, offset: number, video = false): T {
  const media = value as T & { sourceOffset?: number; sourceDuration?: number; loop?: boolean };
  const position = (media.sourceOffset || 0) + Math.max(0, offset - (value.enable?.start || 0));
  return {
    ...value,
    ...(video ? { sourceOffset: media.loop !== false && media.sourceDuration ? position % media.sourceDuration : position } : {}),
    ...(value.enable ? { enable: { start: Math.max(0, value.enable.start - offset), end: value.enable.end - offset } } : {}),
  };
}
function splitBackground(value: RenderBackground, offset: number, right: boolean): RenderBackground {
  const result = right
    ? afterSplit(value, offset, value.type === 'video')
    : { ...value, ...(value.enable ? { enable: { start: value.enable.start, end: Math.min(offset, value.enable.end) } } : {}) };
  return result.enable && result.enable.end <= result.enable.start ? { ...result, enable: undefined, visible: false } : result;
}
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
  const offset = mainRange(item).start + (split - item.trim.in) / item.speed;
  const left = structuredClone(item),
    right = duplicateMedia(item);
  left.trim.out = split;
  right.title = `${item.title} · parte 2`;
  right.trim.in = split;
  right.mediaStart = 0;
  left.render.layers = left.render.layers
    .map((layer) => (layer.enable ? { ...layer, enable: { start: layer.enable.start, end: Math.min(offset, layer.enable.end) } } : layer))
    .filter((layer) => !layer.enable || layer.enable.end > layer.enable.start);
  right.render.layers = right.render.layers
    .map((layer) => afterSplit(layer, offset, layer.type === 'video'))
    .filter((layer) => !layer.enable || layer.enable.end > layer.enable.start);
  left.render.background = splitBackground(item.render.background, offset, false);
  right.render.background = splitBackground(item.render.background, offset, true);
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
    result.mediaStart = source.mediaStart;
    result.render.media.zIndex = source.render.media.zIndex;
    result.render.media.visible = source.render.media.visible;
    result.render.media.audio = source.render.media.audio;
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
