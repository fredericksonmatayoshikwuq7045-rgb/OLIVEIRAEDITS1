import type { MediaItem, Profile, TemplateCategory } from './models';
import type { RenderBackground, RenderSpec, Timing } from '../render/types';
export const BACKGROUND_TRACK = '@background';
export const MEDIA_TRACK = '@media';
export const MAX_TIME = 86400;
export interface Track extends Timing {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'background';
  zIndex: number;
  sourceOffset?: number;
  sourceDuration?: number;
  loop?: boolean;
  source?: string;
  audio?: 'mute' | 'mix';
}
export const categoryNames: Record<TemplateCategory, string> = {
  border: 'Borda',
  watermark: 'Marca',
  headline: 'Headline',
  background: 'Fundo',
};
export function compositionDuration(item: MediaItem): number {
  const end = mainRange(item).end;
  const background = item.render.background;
  return Math.min(
    MAX_TIME,
    Math.max(
      end,
      background.visible === false ? 0 : background.enable?.end || 0,
      ...item.render.layers.map((layer) =>
        layer.visible === false
          ? 0
          : layer.enable?.end ||
            (layer.type === 'video' && (layer.id.startsWith('template:headline:') || layer.id.startsWith('template-headline-'))
              ? layer.sourceDuration || 0
              : 0),
      ),
    ),
  );
}
export function mainRange(item: MediaItem) {
  const start = Math.max(0, item.mediaStart || 0);
  const bg = item.render.background;
  const inferred = Math.max(
    5,
    'sourceDuration' in bg ? bg.sourceDuration || 0 : 0,
    ...item.render.layers.map((layer) => ('sourceDuration' in layer ? layer.sourceDuration || 0 : 0)),
  );
  const span =
    item.kind === 'video'
      ? Math.max(0.001, (item.trim.out - item.trim.in) / item.speed)
      : Math.min(MAX_TIME, Math.max(0.1, item.imageDuration || inferred));
  return { start, end: start + span };
}
export function compositionSpec(item: MediaItem): RenderSpec {
  const background =
    item.render.media.fit === 'blur'
      ? { type: 'blur' as const, radius: 0.025, enable: item.render.background.enable, visible: item.render.background.visible }
      : item.render.background;
  return { ...item.render, background, media: { ...item.render.media, enable: mainRange(item) } };
}
export function outputTime(item: MediaItem, time: number) {
  return item.kind === 'video' ? (time - item.trim.in) / item.speed + mainRange(item).start : time;
}
export function playerTime(item: MediaItem, time: number) {
  return item.kind === 'video' ? item.trim.in + (time - mainRange(item).start) * item.speed : time;
}
export function imageFrameTime(item: MediaItem): number {
  return Math.min(Math.max(0, Number.isFinite(item.imageTime) ? item.imageTime || 0 : 0), compositionDuration(item) - 0.001);
}
export function trackName(item: MediaItem, id: string, profile: Profile): string {
  if (id === MEDIA_TRACK) return `Mídia · ${item.title}`;
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
      ? {
          source: background.source,
          sourceOffset: background.sourceOffset,
          sourceDuration: background.sourceDuration,
          loop: background.loop,
          audio: background.audio,
        }
      : {}),
  };
  const main: Track = {
    id: MEDIA_TRACK,
    name: trackName(item, MEDIA_TRACK, profile),
    type: item.kind,
    zIndex: item.render.media.zIndex,
    source: item.runtimeUrl || item.render.media.source,
    enable: mainRange(item),
    visible: item.render.media.visible !== false,
  };
  return [...item.render.layers.map((layer) => ({ ...layer, name: trackName(item, layer.id, profile) })), main, base].sort(
    (a, b) => b.zIndex - a.zIndex,
  );
}
export function trackRange(track: Timing, duration: number): { start: number; end: number } {
  return track.enable || { start: 0, end: duration };
}
export function patchTrack(
  item: MediaItem,
  id: string,
  patch: Partial<Pick<Track, 'enable' | 'visible' | 'sourceOffset' | 'loop' | 'zIndex' | 'audio'>>,
): MediaItem {
  if (id === MEDIA_TRACK) {
    const { enable, ...change } = patch;
    return {
      ...item,
      ...(enable ? { mediaStart: enable.start } : {}),
      render: { ...item.render, media: { ...item.render.media, ...change } },
    };
  }
  if (id === BACKGROUND_TRACK)
    return { ...item, render: { ...item.render, background: { ...item.render.background, ...patch } as RenderBackground } };
  return {
    ...item,
    render: { ...item.render, layers: item.render.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) },
  };
}
export function reorderTrack(item: MediaItem, id: string, target: string): MediaItem {
  const ids = [...item.render.layers, { id: MEDIA_TRACK, zIndex: item.render.media.zIndex }]
    .sort((a, b) => b.zIndex - a.zIndex)
    .map((layer) => layer.id);
  if (!ids.includes(id) || !ids.includes(target) || id === target) return item;
  const targetIndex = ids.indexOf(target);
  ids.splice(ids.indexOf(id), 1);
  ids.splice(targetIndex, 0, id);
  const order = (key: string) => (ids.length - ids.indexOf(key)) * 10;
  return {
    ...item,
    render: {
      ...item.render,
      media: { ...item.render.media, zIndex: order(MEDIA_TRACK) },
      layers: item.render.layers.map((layer) => ({ ...layer, zIndex: order(layer.id) })),
    },
  };
}
export function editTrackRange(item: MediaItem, id: string, range: { start: number; end: number }, edge = 'move'): MediaItem {
  if (id !== MEDIA_TRACK) {
    const track = id === BACKGROUND_TRACK ? item.render.background : item.render.layers.find((layer) => layer.id === id);
    const offset = track && 'sourceOffset' in track ? track.sourceOffset || 0 : 0;
    return patchTrack(item, id, {
      enable: range,
      ...(track && track.type === 'video' && edge === 'start'
        ? { sourceOffset: Math.max(0, offset + range.start - (track.enable?.start || 0)) }
        : {}),
    });
  }
  if (item.kind === 'image') return { ...item, mediaStart: range.start, imageDuration: range.end - range.start };
  const old = mainRange(item),
    limit = item.probe?.duration || item.trim.out;
  if (edge === 'start') {
    const start = Math.max(0, Math.min(item.trim.out - 0.001, item.trim.in + (range.start - old.start) * item.speed));
    return { ...item, mediaStart: Math.max(0, old.start + (start - item.trim.in) / item.speed), trim: { ...item.trim, in: start } };
  }
  if (edge === 'end') return { ...item, trim: { ...item.trim, out: Math.min(limit, item.trim.in + (range.end - old.start) * item.speed) } };
  return { ...item, mediaStart: range.start };
}
export function makeIntro(item: MediaItem, id: string): MediaItem {
  const layer = item.render.layers.find((layer) => layer.id === id);
  if (!layer) return item;
  const span = layer.enable
    ? layer.enable.end - layer.enable.start
    : layer.type === 'video'
      ? Math.max(0.1, (layer.sourceDuration || 3) - (layer.sourceOffset || 0))
      : 3;
  const enable = { start: 0, end: Math.min(MAX_TIME - mainRange(item).end + mainRange(item).start, span) };
  // The text paired with a headline follows its visual when turned into an intro.
  return {
    ...item,
    mediaStart: enable.end,
    render: {
      ...item.render,
      layers: item.render.layers.map((value) =>
        value.id === id || value.id === `${id}:text` ? { ...value, visible: true, enable } : value,
      ),
    },
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
