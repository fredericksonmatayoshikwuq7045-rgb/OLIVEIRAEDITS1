import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import type { MediaItem } from '../domain/models';

/** Optional derived cache. Failure never changes the source or its ready status. */
export async function generateThumbnail(item: MediaItem, nativePath?: string): Promise<string | undefined> {
  if (item.kind !== 'video') return undefined;
  if (isTauri() && nativePath) {
    try {
      return convertFileSrc(await invoke<string>('generate_thumbnail', { path: nativePath }));
    } catch (error) {
      console.warn('Miniatura indisponível:', error);
      return undefined;
    }
  }
  const source = item.runtimeUrl;
  if (!source) return undefined;
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const finish = (url?: string) => {
      clearTimeout(timer);
      video.onerror = null;
      video.onseeked = null;
      video.onloadeddata = null;
      video.removeAttribute('src');
      video.load();
      resolve(url);
    };
    const timer = setTimeout(() => finish(), 5000);
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    const draw = () => {
      if (!video.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = Math.max(1, Math.round((160 * video.videoHeight) / video.videoWidth));
      try {
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        finish();
      }
    };
    video.onerror = () => finish();
    video.onseeked = draw;
    video.onloadeddata = () => {
      const time = Math.min(1, video.duration / 2);
      if (time > 0) video.currentTime = time;
      else draw();
    };
    video.src = source;
  });
}
