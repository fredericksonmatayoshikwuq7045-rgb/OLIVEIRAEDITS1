import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { createMediaItem } from '../domain/defaults';
import type { AssetRef, MediaItem, MediaKind, MediaProbe, Profile } from '../domain/models';
import { AssetManager, saveAsset } from './assets';
import { authorizePaths, isNative } from './storage';
import { generateThumbnail } from './thumbnails';

export function mediaKind(name: string): MediaKind | null {
  if (/\.(mp4|m4v|mov|mkv|avi|webm|wmv|mpeg|mpg|mts|m2ts)$/i.test(name)) return 'video';
  if (/\.(png|jpe?g|webp|gif|bmp|tiff?|avif)$/i.test(name)) return 'image';
  return null;
}
export function baseName(path: string): string {
  return path.split(/[\\/]/).at(-1) || path;
}
export async function probeBrowser(
  url: string,
  kind: MediaKind,
  name: string,
  sizeBytes: number,
  modifiedAt?: number,
): Promise<MediaProbe> {
  return new Promise((resolve, reject) => {
    const media = document.createElement(kind === 'video' ? 'video' : 'img');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Não foi possível ler ${name} em 20 segundos. Use um formato compatível.`));
    }, 20_000);
    const cleanup = () => {
      clearTimeout(timeout);
      media.onerror = null;
      if (media instanceof HTMLVideoElement) {
        media.onloadedmetadata = null;
        media.removeAttribute('src');
        media.load();
      } else media.onload = null;
    };
    media.onerror = () => {
      cleanup();
      reject(new Error(`Arquivo inválido ou codec não disponível no navegador: ${name}. Abra o aplicativo desktop para usar FFmpeg.`));
    };
    const loaded = () => {
      const video = media instanceof HTMLVideoElement ? media : null;
      const image = media instanceof HTMLImageElement ? media : null;
      const width = video?.videoWidth ?? image?.naturalWidth ?? 0;
      const height = video?.videoHeight ?? image?.naturalHeight ?? 0;
      const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
      if (!width || !height || (video && duration <= 0)) {
        cleanup();
        reject(new Error(`Dimensões ou duração inválidas em ${name}.`));
        return;
      }
      const probe: MediaProbe = {
        path: name,
        width,
        height,
        duration,
        fps: 0,
        codec: 'browser',
        modifiedAt,
        pixFmt: '',
        rotation: 0,
        hasAudio: false,
        tags: {},
        sizeBytes,
        isImage: kind === 'image',
      };
      cleanup();
      resolve(probe);
    };
    if (media instanceof HTMLVideoElement) {
      media.preload = 'metadata';
      media.onloadedmetadata = loaded;
    } else media.onload = loaded;
    media.src = url;
  });
}
export async function importMedia(
  input: File | string,
  profile: Profile,
  slot: number,
  manager: AssetManager,
): Promise<{ item: MediaItem; asset?: AssetRef }> {
  const title = typeof input === 'string' ? baseName(input) : input.name;
  const kind = mediaKind(title);
  if (!kind) throw new Error(`Formato não suportado: ${title}. Use um vídeo ou uma imagem compatível.`);
  const item = createMediaItem(kind, slot, profile.aspectRatio);
  item.title = title;
  let asset: AssetRef | undefined;
  if (typeof input === 'string') {
    if (!isNative()) throw new Error('Importação por caminho exige o aplicativo desktop. No navegador, selecione os arquivos.');
    await authorizePaths([input]);
    item.sourcePath = input;
    item.runtimeUrl = convertFileSrc(input);
    item.probe = await invoke<MediaProbe>('probe_media', { path: input });
  } else {
    asset = await saveAsset(profile.id, input, input.name, kind, input.type);
    item.assetId = asset.id;
    item.runtimeUrl = await manager.resolve(asset);
    item.probe = await probeBrowser(item.runtimeUrl, kind, title, input.size, input.lastModified);
  }
  item.status = 'ready';
  item.render.media.source = item.runtimeUrl;
  item.render.media.width = item.probe.width;
  item.render.media.height = item.probe.height;
  item.trim = { in: 0, out: item.probe.duration };
  item.thumbnailUrl = await generateThumbnail(item, item.sourcePath ?? asset?.source);
  return { item, asset };
}
