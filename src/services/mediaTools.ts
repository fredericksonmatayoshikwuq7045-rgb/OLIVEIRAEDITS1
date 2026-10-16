import type { MediaItem, Profile } from '../domain/models';
import type { Rect } from '../render/types';
import { nativeCall } from './backend';

export async function detectBlackBars(item: MediaItem, profile: Profile): Promise<Rect | null> {
  const path = item.sourcePath ?? profile.assets.find((asset) => asset.id === item.assetId)?.source;
  if (!path || !item.probe) throw new Error(`${item.title}: re-vincule o arquivo antes de detectar barras.`);
  const crop = await nativeCall<Rect | null>('crop_detect', { path });
  if (!crop) return null;
  return {
    x: crop.x / item.probe.width,
    y: crop.y / item.probe.height,
    width: crop.width / item.probe.width,
    height: crop.height / item.probe.height,
  };
}
export const clearGeneratedCache = (): Promise<void> => nativeCall('clear_generated_cache');
