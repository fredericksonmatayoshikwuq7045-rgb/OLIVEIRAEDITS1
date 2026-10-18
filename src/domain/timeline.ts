import type { MediaItem, Profile, TemplateCategory } from './models';
import type { RenderBackground, Timing } from '../render/types';
export const BACKGROUND_TRACK = '@background';
export interface Track extends Timing {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'background';
  zIndex: number;
  sourceOffset?: number;
  sourceDuration?: number;
  loop?: boolean;
}
export const categoryNames: Record<TemplateCategory, string> = {
  border: 'Borda',
  watermark: 'Marca',
  headline: 'Headline',
  background: 'Fundo',
};
export function compositionDuration(item: MediaItem): number {
  if (item.kind === 'video') return Math.max(0.001, (item.trim.out - item.trim.in) / item.speed);
  if (item.imageDuration && Number.isFinite(item.imageDuration)) return Math.max(0.1, Math.min(86400, item.imageDuration));
  const background = item.render.background;
  return Math.min(
    86400,
    Math.max(
      5,
      background.enable?.end || 0,
      'sourceDuration' in background ? background.sourceDuration || 0 : 0,
      ...item.render.layers.map((layer) => Math.max(layer.enable?.end || 0, 'sourceDuration' in layer ? layer.sourceDuration || 0 : 0)),
    ),
  );
}
export function imageFrameTime(item: MediaItem): number {
  return Math.min(Math.max(0, Number.isFinite(item.imageTime) ? item.imageTime || 0 : 0), compositionDuration(item) - 0.001);
}
export function trackName(item: MediaItem, id: string, profile: Profile): string {
  if (id === BACKGROUND_TRACK) {
    const template = profile.templates.find((template) => template.id === item.templates.background);
    return template ? `Fundo · ${template.name}` : 'Fundo';
  }
  const layer = item.render.layers.find((layer) => layer.id === id);
  if (layer?.type === 'text') return layer.text.trim() || 'Texto vazio';
  const template = profile.templates.find((template) => id.includes(template.id));
  return template
    ? `${categoryNames[template.category]} · ${template.name}`
    : layer?.type === 'video'
      ? 'Template em vídeo'
      : 'Camada de imagem';
}
export function timelineTracks(item: MediaItem, profile: Profile): Track[] {
  const background = item.render.background;
  const base: Track = {
    id: BACKGROUND_TRACK,
    name: trackName(item, BACKGROUND_TRACK, profile),
    type: background.type === 'video' ? 'video' : 'background',
    zIndex: -Infinity,
    enable: background.enable,
    visible: background.visible !== false,
    ...('source' in background
      ? { sourceOffset: background.sourceOffset, sourceDuration: background.sourceDuration, loop: background.loop }
      : {}),
  };
  return [...item.render.layers.map((layer) => ({ ...layer, name: trackName(item, layer.id, profile) })), base].sort(
    (a, b) => b.zIndex - a.zIndex,
  );
}
export function trackRange(track: Timing, duration: number): { start: number; end: number } {
  return track.enable || { start: 0, end: duration };
}
export function patchTrack(
  item: MediaItem,
  id: string,
  patch: Partial<Pick<Track, 'enable' | 'visible' | 'sourceOffset' | 'loop'>>,
): MediaItem {
  if (id === BACKGROUND_TRACK)
    return { ...item, render: { ...item.render, background: { ...item.render.background, ...patch } as RenderBackground } };
  return {
    ...item,
    render: { ...item.render, layers: item.render.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) },
  };
}
export function removeTrack(item: MediaItem, id: string): MediaItem {
  if (id === BACKGROUND_TRACK)
    return {
      ...item,
      templates: { ...item.templates, background: null },
      render: { ...item.render, background: { type: 'solid', color: '#111111' } },
    };
  const layers = item.render.layers.filter((layer) => layer.id !== id);
  const templates = { ...item.templates };
  for (const category of ['border', 'watermark', 'headline'] as const) {
    const templateId = templates[category];
    if (
      templateId &&
      item.render.layers.some((layer) => layer.id.includes(templateId)) &&
      !layers.some((layer) => layer.id.includes(templateId))
    )
      templates[category] = null;
  }
  return { ...item, templates, render: { ...item.render, layers } };
}
export function movedRange(
  range: { start: number; end: number },
  delta: number,
  duration: number,
  edge: 'start' | 'end' | 'move',
  step: number,
) {
  const snapped = Math.round(delta / step) * step;
  const end = Math.min(duration, range.end),
    startLimit = Math.max(0, Math.min(duration - step, range.start));
  if (edge === 'start') return { start: Math.max(0, Math.min(end - step, range.start + snapped)), end };
  if (edge === 'end') return { start: startLimit, end: Math.min(duration, Math.max(startLimit + step, range.end + snapped)) };
  const span = Math.min(duration, range.end - range.start),
    start = Math.max(0, Math.min(duration - span, range.start + snapped));
  return { start, end: start + span };
}
