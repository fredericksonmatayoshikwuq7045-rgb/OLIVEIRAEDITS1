import { convertFileSrc } from '@tauri-apps/api/core';
import { uid } from '../domain/defaults';
import type { AssetRef, Profile } from '../domain/models';
import { importAsset, isNative, pathExists, readBytes, writeBytes } from './storage';

export function assetExtension(name: string, mime = ''): string {
  const extension = name.split('.').at(-1)?.toLowerCase();
  if (extension && /^[a-z0-9]{1,8}$/.test(extension) && name.includes('.')) return extension;
  return (
    (
      {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'font/ttf': 'ttf',
        'font/otf': 'otf',
      } as Record<string, string>
    )[mime] ?? 'bin'
  );
}
export function mimeForName(name: string): string {
  const extension = assetExtension(name);
  return (
    (
      {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        svg: 'image/svg+xml',
        webp: 'image/webp',
        gif: 'image/gif',
        bmp: 'image/bmp',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        mkv: 'video/x-matroska',
        webm: 'video/webm',
        ttf: 'font/ttf',
        otf: 'font/otf',
        woff: 'font/woff',
        woff2: 'font/woff2',
      } as Record<string, string>
    )[extension] ?? 'application/octet-stream'
  );
}
export async function saveAsset(
  profileId: string,
  input: File | string | Uint8Array,
  name: string,
  kind: AssetRef['kind'],
  mimeType = mimeForName(name),
): Promise<AssetRef> {
  const id = uid();
  const relativePath = `profiles/${profileId}/assets/${id}.${assetExtension(name, mimeType)}`;
  const source =
    typeof input === 'string'
      ? await importAsset(input, relativePath)
      : await writeBytes(relativePath, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));
  return { id, relativePath, source, name, kind, mimeType };
}
export async function dataUrlBytes(dataUrl: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const match = /^data:([^;,]*)(;[^,]*)?,([\s\S]*)$/i.exec(dataUrl);
  if (!match) throw new Error('O template antigo não contém uma data URL válida. O original foi preservado no backup.');
  const mimeType = match[1] || 'application/octet-stream';
  const binary = /;base64(?:;|$)/i.test(match[2] ?? '') ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = /;base64(?:;|$)/i.test(match[2] ?? '')
    ? Uint8Array.from(binary, (char) => char.charCodeAt(0))
    : new TextEncoder().encode(binary);
  return { bytes, mimeType };
}

/** Own every object URL; persisted state contains only asset:<UUID> references. */
export class AssetManager {
  private urls = new Map<string, string>();
  private reverse = new Map<string, string>();
  private pending = new Map<string, Promise<string>>();
  private fonts = new Map<string, FontFace>();
  private disposed = false;
  async resolve(asset: AssetRef): Promise<string> {
    const cached = this.urls.get(asset.id);
    if (cached) return cached;
    const pending = this.pending.get(asset.id);
    if (pending) return pending;
    const operation = (async () => {
      let url: string;
      if (isNative()) {
        if (!(await pathExists(asset.source))) throw new Error(`Asset ausente: ${asset.name}. Restaure o backup do perfil.`);
        url = convertFileSrc(asset.source);
      } else {
        const bytes = await readBytes(asset.relativePath);
        url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: asset.mimeType }));
      }
      if (this.disposed) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        throw new Error('Carregamento de assets encerrado.');
      }
      this.urls.set(asset.id, url);
      this.reverse.set(url, `asset:${asset.id}`);
      return url;
    })();
    this.pending.set(asset.id, operation);
    try {
      return await operation;
    } finally {
      this.pending.delete(asset.id);
    }
  }
  stable(source: string): string {
    return this.reverse.get(source) ?? source;
  }
  async loadFonts(profile: Profile): Promise<void> {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
    for (const font of profile.fonts) {
      if (this.fonts.has(font.id)) continue;
      const asset = profile.assets.find((entry) => entry.id === font.assetId);
      if (!asset) throw new Error(`Fonte ausente: ${font.name}. Importe-a novamente.`);
      const url = await this.resolve(asset);
      const face = new FontFace(font.family, `url(${JSON.stringify(url)})`);
      await face.load();
      document.fonts.add(face);
      this.fonts.set(font.id, face);
    }
  }
  releaseUnused(assetIds: Set<string>): void {
    for (const [id, url] of this.urls) {
      if (assetIds.has(id)) continue;
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      this.urls.delete(id);
      this.reverse.delete(url);
    }
  }
  dispose(): void {
    this.disposed = true;
    this.releaseUnused(new Set());
    for (const face of this.fonts.values()) if (typeof document !== 'undefined') document.fonts.delete(face);
    this.fonts.clear();
  }
}
