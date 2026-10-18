import type { MediaItem, Profile } from '../domain/models';
import { isNative, mediaUrl, nativeCall } from './backend';
export interface SampleFrame {
  time: number;
  url: string;
}
export async function sampleFrames(
  item: MediaItem,
  profile: Profile,
  count = 8,
  selectedRange = false,
  width = 480,
): Promise<SampleFrame[]> {
  const duration = item.probe?.duration || item.trim.out;
  const start = selectedRange ? item.trim.in : 0,
    end = selectedRange ? item.trim.out : duration;
  const times =
    item.kind === 'image'
      ? [0]
      : Array.from({ length: count }, (_, i) => Math.min(duration - 0.001, start + ((end - start) * (i + 0.5)) / count));
  if (isNative()) {
    const path = item.sourcePath ?? profile.assets.find((asset) => asset.id === item.assetId)?.source;
    if (!path) throw new Error('Revincule a mídia para analisar seus quadros.');
    const frames = await nativeCall<{ time: number; path: string }[]>('sample_media_frames', { path, times, width });
    return frames.map((frame) => ({ time: frame.time, url: mediaUrl(frame.path) }));
  }
  if (item.kind === 'image') return [{ time: 0, url: item.runtimeUrl || item.render.media.source }];
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const wait = (event: 'loadeddata' | 'seeked') =>
    new Promise<void>((resolve, reject) => {
      const done = (error?: Error) => {
        clearTimeout(timer);
        video.removeEventListener(event, ok);
        video.removeEventListener('error', failed);
        if (error) reject(error);
        else resolve();
      };
      const ok = () => done(),
        failed = () => done(new Error('O navegador não conseguiu ler os quadros. Use o aplicativo desktop para este codec.'));
      const timer = setTimeout(() => done(new Error('Tempo esgotado ao ler o vídeo.')), 10000);
      video.addEventListener(event, ok, { once: true });
      video.addEventListener('error', failed, { once: true });
    });
  try {
    const ready = wait('loadeddata');
    video.src = item.runtimeUrl || item.render.media.source;
    await ready;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.min(width, video.videoWidth, Math.round((1920 * video.videoWidth) / video.videoHeight)));
    canvas.height = Math.max(2, Math.round((canvas.width * video.videoHeight) / video.videoWidth));
    const result: SampleFrame[] = [];
    for (const time of times) {
      if (Math.abs(video.currentTime - time) > 0.001) {
        const seek = wait('seeked');
        video.currentTime = time;
        await seek;
      }
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
      result.push({ time, url: canvas.toDataURL('image/jpeg', 0.7) });
    }
    return result;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
