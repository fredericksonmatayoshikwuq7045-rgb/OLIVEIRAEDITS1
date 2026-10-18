import { disposeAssets, loadAssets, seekAssets, type RenderAsset, type RenderAssets, type SourceResolver } from './assets';
import { computeGeometry } from './geometry';
import { drawText, prepareFonts } from './text';
import type { RenderImageLayer, RenderLayer, RenderSpec } from './types';
import { activeAt, backgroundVideoKey, layerVideoKey } from './playback';

export interface CompositionOptions {
  assets?: RenderAssets;
  resolveSource?: SourceResolver;
  time?: number;
}
export interface StaticPlane {
  id: string;
  zIndex: number;
  png: Blob;
  enable?: { start: number; end: number };
}

function dimensions(asset: RenderAsset): { width: number; height: number } {
  return asset instanceof HTMLVideoElement
    ? { width: asset.videoWidth, height: asset.videoHeight }
    : { width: asset.naturalWidth, height: asset.naturalHeight };
}

function fitImage(
  context: CanvasRenderingContext2D,
  asset: RenderAsset,
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'stretch',
): void {
  const source = dimensions(asset);
  if (!source.width || !source.height) return;
  const scale =
    fit === 'cover' ? Math.max(width / source.width, height / source.height) : Math.min(width / source.width, height / source.height);
  const drawWidth = fit === 'stretch' ? width : source.width * scale;
  const drawHeight = fit === 'stretch' ? height : source.height * scale;
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.drawImage(asset, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function drawMedia(context: CanvasRenderingContext2D, spec: RenderSpec, assets: RenderAssets): void {
  const asset = assets.get(spec.media.source);
  if (!asset) return;
  const geometry = computeGeometry(spec);
  const crop = geometry.sourceCrop;
  context.save();
  context.globalAlpha = spec.media.opacity;
  context.transform(...geometry.matrix);
  if (geometry.circle) {
    context.beginPath();
    context.ellipse(
      crop.width / 2,
      crop.height / 2,
      (geometry.circle.radius * crop.width) / geometry.drawRect.width,
      (geometry.circle.radius * crop.height) / geometry.drawRect.height,
      0,
      0,
      Math.PI * 2,
    );
    context.clip();
  }
  context.drawImage(asset, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  context.restore();
}

function drawImageLayer(context: CanvasRenderingContext2D, layer: RenderImageLayer, spec: RenderSpec, assets: RenderAssets): void {
  const asset = assets.get(layer.type === 'video' ? layerVideoKey(layer.id) : layer.source);
  if (!asset) return;
  const width = layer.rect.width * spec.canvas.width;
  const height = layer.rect.height * spec.canvas.height;
  context.save();
  context.globalAlpha = layer.opacity;
  context.translate(layer.rect.x * spec.canvas.width + width / 2, layer.rect.y * spec.canvas.height + height / 2);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.translate(-width / 2, -height / 2);
  fitImage(context, asset, width, height, layer.fit);
  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D, spec: RenderSpec, assets: RenderAssets, time: number): void {
  const { width, height } = spec.canvas;
  const background = spec.background;
  context.fillStyle = activeAt(background, time) && background.type === 'solid' ? background.color : '#111111';
  context.fillRect(0, 0, width, height);
  if (!activeAt(background, time)) return;
  if (background.type === 'gradient') {
    const angle = (background.angle * Math.PI) / 180;
    const dx = Math.cos(angle),
      dy = Math.sin(angle);
    const reach = (Math.abs(dx) * width + Math.abs(dy) * height) / 2;
    const gradient = context.createLinearGradient(
      width / 2 - dx * reach,
      height / 2 - dy * reach,
      width / 2 + dx * reach,
      height / 2 + dy * reach,
    );
    gradient.addColorStop(0, background.from);
    gradient.addColorStop(1, background.to);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  } else if (background.type === 'image' || background.type === 'video') {
    const asset = assets.get(background.type === 'video' ? backgroundVideoKey : background.source);
    if (asset) {
      context.save();
      context.globalAlpha = background.opacity;
      fitImage(context, asset, width, height, 'cover');
      context.restore();
    }
  }
  if (background.type === 'blur' || spec.media.fit === 'blur') {
    const radius = background.type === 'blur' ? background.radius : 0.025;
    const asset = assets.get(spec.media.source);
    if (asset) {
      context.save();
      context.filter = `blur(${Math.max(0, radius * Math.min(width, height))}px)`;
      const overscan = radius * Math.min(width, height) * 2;
      context.translate(-overscan, -overscan);
      fitImage(context, asset, width + overscan * 2, height + overscan * 2, 'cover');
      context.restore();
    }
  }
}

export function drawLayer(context: CanvasRenderingContext2D, layer: RenderLayer, spec: RenderSpec, assets: RenderAssets, time = 0): void {
  if (!activeAt(layer, time)) return;
  if (layer.type === 'text') drawText(context, layer, spec);
  else drawImageLayer(context, layer, spec, assets);
}

/** The only frame renderer: interactive preview and still export both call this. */
export function drawFrame(context: CanvasRenderingContext2D, spec: RenderSpec, assets: RenderAssets, time = 0): void {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, spec.canvas.width, spec.canvas.height);
  drawBackground(context, spec, assets, time);
  const entries = [
    { zIndex: spec.media.zIndex, layer: null as RenderLayer | null },
    ...spec.layers.map((layer) => ({ zIndex: layer.zIndex, layer })),
  ];
  entries.sort((left, right) => left.zIndex - right.zIndex);
  for (const entry of entries) {
    if (entry.layer) drawLayer(context, entry.layer, spec, assets, time);
    else drawMedia(context, spec, assets);
  }
  context.restore();
}

function makeCanvas(spec: RenderSpec): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = spec.canvas.width;
  canvas.height = spec.canvas.height;
  return canvas;
}

export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob && blob.type === type
          ? resolve(blob)
          : reject(new Error('Este navegador não conseguiu gerar o formato de imagem escolhido. Tente PNG.')),
      type,
      quality,
    ),
  );
}

export async function composeCanvas(spec: RenderSpec, options: CompositionOptions = {}): Promise<HTMLCanvasElement> {
  await prepareFonts(spec);
  const assets = options.assets ?? (await loadAssets(spec, options.resolveSource));
  try {
    if (options.time !== undefined) await seekAssets(assets, options.time, spec);
    const canvas = makeCanvas(spec);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível neste ambiente.');
    drawFrame(context, spec, assets, options.time);
    return canvas;
  } finally {
    if (!options.assets) disposeAssets(assets);
  }
}

/** Static groups are split around every video/main layer, preserving arbitrary z order. */
export async function compileStaticPlanes(
  spec: RenderSpec,
  options: Pick<CompositionOptions, 'resolveSource'> = {},
): Promise<StaticPlane[]> {
  const staticSpec: RenderSpec = {
    ...spec,
    media: { ...spec.media, source: '' },
    background: { type: 'solid', color: '#00000000' },
    layers: spec.layers.filter((layer) => layer.type !== 'video'),
  };
  await prepareFonts(spec);
  const assets = await loadAssets(staticSpec, options.resolveSource);
  try {
    const entries = [
      { zIndex: spec.media.zIndex, layer: null as RenderLayer | null },
      ...spec.layers.filter((layer) => layer.visible).map((layer) => ({ zIndex: layer.zIndex, layer })),
    ].sort((left, right) => left.zIndex - right.zIndex);
    const groups: RenderLayer[][] = [];
    let current: RenderLayer[] = [];
    for (const { layer } of entries) {
      const changedEnable = current.length > 0 && JSON.stringify(current[0].enable) !== JSON.stringify(layer?.enable);
      if (!layer || layer.type === 'video' || changedEnable) {
        if (current.length) groups.push(current);
        current = [];
      }
      if (layer && layer.type !== 'video') current.push(layer);
    }
    if (current.length) groups.push(current);
    const planes: StaticPlane[] = [];
    for (const group of groups) {
      const canvas = makeCanvas(spec);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D indisponível neste ambiente.');
      for (const layer of group) drawLayer(context, { ...layer, enable: undefined }, spec, assets);
      planes.push({
        id: group.map((layer) => layer.id).join('+'),
        zIndex: group[0].zIndex,
        png: await canvasBlob(canvas),
        enable: group[0].enable,
      });
    }
    return planes;
  } finally {
    disposeAssets(assets);
  }
}
