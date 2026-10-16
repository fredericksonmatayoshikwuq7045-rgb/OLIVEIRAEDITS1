import { outputFilename } from '../domain/batch';
import type { MediaItem, Profile } from '../domain/models';
import { canvasBlob, compileStaticPlanes, composeCanvas } from '../render/compositor';
import { computeGeometry } from '../render/geometry';
import type { RenderImageLayer } from '../render/types';
import { isNative, mediaUrl, nativeCall } from './backend';
import type { ExportItem, ExportOptions } from './contracts';
import { getFfmpegInfo, startExport } from './queue';
import { recordImageExport, resetImageExportReport, type ImageExportResult } from './imageReport';

const joinPath = (directory: string, filename: string) => `${directory.replace(/[\\/]$/, '')}/${filename}`;
function sourceResolver(profile?: Profile): (source: string) => string {
  return (source) => {
    const asset = profile?.assets.find((entry) => entry.source === source || entry.runtimeUrl === source || `asset:${entry.id}` === source);
    return asset ? (asset.runtimeUrl ?? mediaUrl(asset.source)) : mediaUrl(source);
  };
}
function filename(item: MediaItem, profile: Profile, index: number, extension: string): string {
  return outputFilename(
    profile.exportSettings.filenamePattern,
    {
      conta: profile.handle || profile.name,
      slot: item.slot,
      n: index + 1,
      original: item.title,
      aspect: `${item.render.canvas.width}:${item.render.canvas.height}`,
    },
    extension,
  );
}
function nativeSource(source: string, profile: Profile): string {
  const asset = profile.assets.find((entry) => entry.runtimeUrl === source || entry.source === source || `asset:${entry.id}` === source);
  if (asset) return asset.source;
  if (/^(blob:|data:|https?:|asset:)/.test(source))
    throw new Error('Um asset não tem caminho local. Reimporte-o no perfil antes de exportar.');
  return source;
}
function itemSource(item: MediaItem, profile: Profile): string {
  const source = item.sourcePath ?? profile.assets.find((asset) => asset.id === item.assetId)?.source;
  if (!source) throw new Error(`Arquivo original ausente: ${item.title}. Use Re-vincular.`);
  return source;
}
export async function prepareExportItem(item: MediaItem, profile: Profile, index = 0, options: ExportOptions = {}): Promise<ExportItem> {
  if (item.status !== 'ready') throw new Error(`${item.title}: a mídia não está pronta. Re-vincule arquivos ausentes.`);
  if (!profile.exportSettings.outputDir) throw new Error('Escolha a pasta de saída nas configurações da conta.');
  const spec = structuredClone(item.render);
  const planes = await compileStaticPlanes(spec, { resolveSource: sourceResolver(profile) });
  const overlays = [];
  for (const plane of planes) {
    const path = await nativeCall<string>('cache_asset', {
      name: `${crypto.randomUUID()}.png`,
      bytes: Array.from(new Uint8Array(await plane.png.arrayBuffer())),
    });
    overlays.push({ path, zIndex: plane.zIndex, enable: plane.enable });
  }
  if ('source' in spec.background) spec.background.source = nativeSource(spec.background.source, profile);
  if (spec.media.fit === 'blur') spec.background = { type: 'blur', radius: 0.025 };
  const layers = spec.layers
    .filter((layer): layer is RenderImageLayer => layer.type === 'video' && layer.visible)
    .map((layer) => ({ ...layer, source: nativeSource(layer.source, profile) }));
  return {
    id: item.id,
    sourcePath: itemSource(item, profile),
    outputPath: joinPath(profile.exportSettings.outputDir, filename(item, profile, index, 'mp4')),
    trim: { start: item.trim.in, duration: item.trim.out - item.trim.in },
    render: { ...spec, geometry: computeGeometry(spec), layers },
    overlays,
    preset: profile.exportSettings.preset,
    encoder: profile.exportSettings.encoder,
    cleanMetadata: profile.exportSettings.cleanMetadata,
    conflict: profile.exportSettings.conflict,
    mode: 'render',
    speed: item.speed,
    fps: options.fps,
    silentAudio: options.silentAudio,
  };
}
export async function downloadBlob(blob: Blob, name: string): Promise<void> {
  if (!blob.size) throw new Error('O arquivo gerado está vazio.');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportImage(item: MediaItem, profile?: Profile, index = 0): Promise<ImageExportResult> {
  if (item.status !== 'ready') throw new Error('Re-vincule a imagem ausente antes de exportar.');
  const format = profile?.exportSettings.imageFormat ?? 'png';
  const canvas = await composeCanvas(
    { ...item.render, media: { ...item.render.media, source: item.runtimeUrl || item.render.media.source } },
    { resolveSource: sourceResolver(profile) },
  );
  const blob = await canvasBlob(canvas, `image/${format}`, profile?.exportSettings.imageQuality ?? 0.92);
  const extension = format === 'jpeg' ? 'jpg' : format;
  const name = profile ? filename(item, profile, index, extension) : `${item.title.replace(/\.[^.]+$/, '')}_editado.${extension}`;
  if (isNative() && profile) {
    if (!profile.exportSettings.outputDir) throw new Error('Escolha a pasta de saída da conta.');
    const result = await nativeCall<{ path: string | null; status: 'ok' | 'skipped' }>('storage_export_image', {
      sourcePath: itemSource(item, profile),
      outputDir: profile.exportSettings.outputDir,
      filename: name,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      conflict: profile.exportSettings.conflict,
    });
    return {
      id: item.id,
      title: item.title,
      filename: name,
      status: result.status,
      path: result.path,
      bytes: result.status === 'ok' ? blob.size : undefined,
    };
  }
  await downloadBlob(blob, name);
  return { id: item.id, title: item.title, filename: name, status: 'download', bytes: blob.size };
}
export async function exportItems(profile: Profile, items: MediaItem[], options: ExportOptions = {}): Promise<string> {
  if (!items.length) throw new Error('Selecione ao menos uma mídia para exportar.');
  const videos = items.filter((item) => item.kind === 'video');
  if (videos.length && !isNative()) throw new Error('Vídeos precisam do aplicativo desktop com FFmpeg. No navegador, exporte imagens.');
  if (videos.length) {
    const health = await getFfmpegInfo();
    if (!health.available) throw new Error(health.warnings.join('\n') || 'FFmpeg indisponível. Confira Configurações.');
  }
  resetImageExportReport();
  for (const [index, item] of items.entries())
    if (item.kind === 'image') {
      try {
        recordImageExport(await exportImage(item, profile, index));
      } catch (error) {
        recordImageExport({ id: item.id, title: item.title, filename: item.title, status: 'error', error: String(error) });
      }
    }
  if (!videos.length) return 'images-exported';
  const prepared: ExportItem[] = [];
  for (const [index, item] of videos.entries()) prepared.push(await prepareExportItem(item, profile, index, options));
  return startExport({
    items: prepared,
    finishAction: options.finishAction,
    concurrency: options.concurrency ?? (profile.exportSettings.preset === 'nvenc' ? 2 : 1),
  });
}
export async function renderPreview(
  item: MediaItem,
  profile: Profile,
  options: { seconds?: number; frame?: boolean } = {},
): Promise<string> {
  const temporaryProfile = {
    ...profile,
    exportSettings: { ...profile.exportSettings, outputDir: profile.exportSettings.outputDir || '.' },
  };
  const prepared = await prepareExportItem(item, temporaryProfile);
  const path = await nativeCall<string>('render_preview', { item: prepared, seconds: options.seconds ?? 3, frame: options.frame ?? false });
  return mediaUrl(path);
}
export async function cleanMetadataOnly(
  profile: Profile,
  items: MediaItem[],
  options: { deepClean?: boolean; moveOriginal?: boolean } = {},
): Promise<string> {
  if (!profile.exportSettings.outputDir) throw new Error('Escolha uma pasta de saída para os arquivos limpos.');
  const request: ExportItem[] = items.map((item, index) => ({
    id: item.id,
    sourcePath: itemSource(item, profile),
    outputPath: joinPath(
      profile.exportSettings.outputDir,
      filename(
        item,
        profile,
        index,
        item.kind === 'image' ? (profile.exportSettings.imageFormat === 'jpeg' ? 'jpg' : profile.exportSettings.imageFormat) : 'mp4',
      ),
    ),
    overlays: [],
    preset: profile.exportSettings.preset,
    encoder: profile.exportSettings.encoder,
    cleanMetadata: true,
    conflict: profile.exportSettings.conflict,
    mode: 'metadata',
    speed: 1,
    deepClean: options.deepClean ?? false,
    moveOriginal: options.moveOriginal ?? false,
  }));
  return nativeCall('clean_metadata_only', { job: { items: request, concurrency: 1 } });
}
