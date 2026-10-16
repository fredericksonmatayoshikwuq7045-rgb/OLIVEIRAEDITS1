import type { RenderSpec } from './types';

export type RenderAsset = HTMLImageElement | HTMLVideoElement;
export type RenderAssets = Map<string, RenderAsset>;
export type SourceResolver = (source: string) => string;
export interface AssetRequest {
  source: string;
  type: 'image' | 'video';
}

export function assetRequests(spec: RenderSpec): AssetRequest[] {
  const requests: AssetRequest[] = [];
  if (spec.media.source) requests.push({ source: spec.media.source, type: spec.media.type });
  if (spec.background.type === 'image' || spec.background.type === 'video') requests.push(spec.background);
  for (const layer of spec.layers) {
    if (layer.visible && layer.type !== 'text' && layer.source) requests.push({ source: layer.source, type: layer.type });
  }
  return [...new Map(requests.map((request) => [request.source, request])).values()];
}

function loadAsset(request: AssetRequest, resolveSource: SourceResolver): Promise<RenderAsset> {
  return new Promise((resolve, reject) => {
    const element = request.type === 'video' ? document.createElement('video') : new Image();
    element.crossOrigin = 'anonymous';
    const timeout = window.setTimeout(() => fail(), 30000);
    const clear = () => {
      window.clearTimeout(timeout);
      element.onerror = null;
    };
    const fail = () => {
      clear();
      reject(new Error('Não foi possível abrir uma mídia da prévia. Verifique o arquivo e vincule novamente.'));
    };
    element.onerror = fail;
    if (element instanceof HTMLVideoElement) {
      element.preload = 'auto';
      element.playsInline = true;
      element.muted = true;
      element.onloadeddata = () => {
        clear();
        element.onloadeddata = null;
        resolve(element);
      };
    } else {
      element.onload = () => {
        clear();
        element.onload = null;
        resolve(element);
      };
    }
    element.src = resolveSource(request.source);
  });
}

export async function loadAssets(spec: RenderSpec, resolveSource: SourceResolver = (source) => source): Promise<RenderAssets> {
  const assets: RenderAssets = new Map();
  const settled = await Promise.allSettled(
    assetRequests(spec).map(async (request) => {
      const asset = await loadAsset(request, resolveSource);
      assets.set(request.source, asset);
    }),
  );
  const error = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (error) {
    disposeAssets(assets);
    throw error.reason;
  }
  return assets;
}

export function disposeAssets(assets: RenderAssets): void {
  for (const asset of assets.values()) {
    if (asset instanceof HTMLVideoElement) {
      asset.pause();
      asset.removeAttribute('src');
      asset.load();
    }
  }
  assets.clear();
}

export async function seekAssets(assets: RenderAssets, time: number): Promise<void> {
  await Promise.all(
    [...assets.values()]
      .filter((asset): asset is HTMLVideoElement => asset instanceof HTMLVideoElement)
      .map(
        (asset) =>
          new Promise<void>((resolve, reject) => {
            const target = asset.duration > 0 && Number.isFinite(asset.duration) ? time % asset.duration : time;
            if (Math.abs(asset.currentTime - target) < 0.001) {
              resolve();
              return;
            }
            const timeout = window.setTimeout(() => {
              cleanup();
              reject(new Error('Tempo limite ao buscar frame da mídia.'));
            }, 10000);
            const cleanup = () => {
              window.clearTimeout(timeout);
              asset.removeEventListener('seeked', ready);
            };
            const ready = () => {
              cleanup();
              resolve();
            };
            asset.addEventListener('seeked', ready, { once: true });
            asset.currentTime = Math.max(0, target);
          }),
      ),
  );
}
