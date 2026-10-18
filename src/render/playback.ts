import type { RenderSpec, Timing } from './types';
export const backgroundVideoKey = '@video:background';
export const layerVideoKey = (id: string) => `@video:layer:${id}`;
export function activeAt(value: Timing, time: number): boolean {
  return value.visible !== false && (!value.enable || (time >= value.enable.start && time < value.enable.end));
}
export interface VideoBinding extends Timing {
  key: string;
  source: string;
  main?: boolean;
  loop: boolean;
  sourceOffset?: number;
  audio?: boolean;
}
export function videoBindings(spec: RenderSpec): VideoBinding[] {
  const entries: VideoBinding[] = [];
  if (spec.media.type === 'video' && spec.media.source)
    entries.push({
      ...spec.media,
      key: spec.media.source,
      source: spec.media.source,
      main: true,
      loop: false,
      audio: spec.media.audio !== 'mute',
    });
  const background = spec.background;
  if (background.type === 'video')
    entries.push({ ...background, key: backgroundVideoKey, loop: background.loop, audio: background.audio === 'mix' });
  for (const layer of spec.layers)
    if (layer.type === 'video')
      entries.push({ ...layer, key: layerVideoKey(layer.id), loop: layer.loop !== false, audio: layer.audio === 'mix' });
  return entries;
}
export function bindingTime(binding: VideoBinding, outputTime: number, duration: number): number {
  const local = Math.max(0, outputTime - (binding.enable?.start || 0)) + Math.max(0, binding.sourceOffset || 0);
  if (!(duration > 0) || !Number.isFinite(duration)) return local;
  return binding.loop ? local % duration : Math.min(local, Math.max(0, duration - 0.001));
}
