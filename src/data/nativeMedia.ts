import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { isNative } from './storage';
/** Linux uses scoped range streaming; other desktop platforms keep the asset protocol. */
export async function nativeMediaUrl(path: string, kind: 'image' | 'video'): Promise<string> {
  if (!isNative()) return path;
  if (kind === 'video') return (await invoke<string | null>('storage_media_url', { path })) || convertFileSrc(path);
  return convertFileSrc(path);
}
