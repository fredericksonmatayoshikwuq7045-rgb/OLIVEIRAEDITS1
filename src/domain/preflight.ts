import type { MediaItem, Profile } from './models';
export interface ExportIssue {
  itemId: string;
  message: string;
  blocking: boolean;
}
export function exportIssues(items: MediaItem[], profile: Profile): ExportIssue[] {
  const issues: ExportIssue[] = [];
  for (const item of items) {
    const add = (message: string, blocking = true) => issues.push({ itemId: item.id, message: `${item.title}: ${message}`, blocking });
    if (item.status !== 'ready') {
      add('mídia indisponível; será ignorada neste lote.', false);
      continue;
    }
    if (
      item.kind === 'video' &&
      (!Number.isFinite(item.trim.in + item.trim.out + item.speed) || item.trim.in < 0 || item.trim.out <= item.trim.in || item.speed <= 0)
    )
      add('corte ou velocidade inválidos.');
    const { width, height } = item.render.canvas;
    if (!Number.isFinite(width + height) || width <= 0 || height <= 0 || (item.kind === 'video' && (width % 2 || height % 2)))
      add('dimensões de saída inválidas; vídeos exigem dimensões pares.');
    for (const layer of item.render.layers)
      if (layer.visible && layer.type === 'text') {
        const font = profile.fonts.find((font) => font.family === layer.fontFamily);
        if (font && !profile.assets.some((asset) => asset.id === font.assetId && asset.runtimeUrl))
          add(`fonte “${font.name}” indisponível.`);
      }
  }
  return issues;
}
