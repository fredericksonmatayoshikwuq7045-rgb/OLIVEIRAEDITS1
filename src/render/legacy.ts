import type { ImageItem, TemplateItem, TextLayer, VideoItem } from '../types';
import { createRenderSpec, createTextLayer, OUTPUT_SIZES, type RenderImageLayer, type RenderSpec } from './types';

function templateSize(template: TemplateItem): { width: number; height: number } {
  try {
    if (template.dataUrl.startsWith('data:image/svg+xml')) {
      const svg = decodeURIComponent(template.dataUrl.slice(template.dataUrl.indexOf(',') + 1));
      const width = Number(svg.match(/\bwidth=["']([\d.]+)/)?.[1]);
      const height = Number(svg.match(/\bheight=["']([\d.]+)/)?.[1]);
      if (width > 0 && height > 0) return { width, height };
      const viewBox = svg.match(/viewBox=["'][^"']*?([\d.]+)\s+([\d.]+)["']/);
      if (viewBox && Number(viewBox[1]) > 0 && Number(viewBox[2]) > 0) {
        return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
      }
    }
    if (template.dataUrl.startsWith('data:image/png;base64,')) {
      const bytes = Uint8Array.from(atob(template.dataUrl.split(',')[1]), (character) => character.charCodeAt(0));
      if (bytes.length >= 24) {
        const view = new DataView(bytes.buffer);
        const width = view.getUint32(16),
          height = view.getUint32(20);
        if (width && height) return { width, height };
      }
    }
  } catch {
    /* Unknown legacy assets keep their payload for later probing. */
  }
  return template.category === 'border' || template.category === 'background' ? { width: 9, height: 16 } : { width: 4, height: 1 };
}

export function legacyTextLayer(layer: TextLayer) {
  const result = createTextLayer(layer.id);
  return {
    ...result,
    text: layer.text,
    fontFamily: layer.fontFamily,
    fontSize: (layer.fontSize * 0.45) / 280,
    bold: layer.bold,
    italic: layer.italic,
    color: layer.color,
    align: layer.align,
    visible: layer.visible,
    zIndex: layer.zIndex ?? 40,
    rect: { x: layer.x / 100, y: layer.y / 100, width: layer.width / 100, height: 0.1 },
    background: { ...result.background, color: layer.bgColor, opacity: layer.bgOpacity },
  };
}

/** Converts obsolete preview-pixel units once; callers keep the original payload as backup. */
export function legacyRenderSpec(item: ImageItem | VideoItem, templates: TemplateItem[]): RenderSpec {
  const size = OUTPUT_SIZES[item.aspectRatio] ?? OUTPUT_SIZES['9:16'];
  const spec = createRenderSpec(size.width, size.height, item.url ?? '', 'trimIn' in item ? 'video' : 'image');
  const previewWidth = (280 * size.width) / size.height;
  spec.media.zoom = item.scale;
  spec.media.pan = { x: item.cropX / previewWidth, y: item.cropY / 280 };
  spec.media.rotation = item.rotation ?? 0;
  spec.media.flipH = item.flipH;
  spec.media.mask = item.cropMask === 'circle' ? 'circle' : 'none';
  spec.media.opacity = item.templatePlacements.media?.opacity ?? 1;
  spec.media.zIndex = item.templatePlacements.media?.zIndex ?? 10;
  if (item.mediaCrop)
    spec.media.crop = {
      x: item.mediaCrop.x / 100,
      y: item.mediaCrop.y / 100,
      width: item.mediaCrop.width / 100,
      height: item.mediaCrop.height / 100,
    };
  spec.layers = (item.textLayers ?? []).map(legacyTextLayer);
  for (const category of ['background', 'watermark', 'headline', 'border'] as const) {
    const template = templates.find((candidate) => candidate.id === item.templates[category]);
    if (!template) continue;
    const dimensions = templateSize(template);
    const placement = item.templatePlacements[category];
    if (category === 'background') {
      spec.background = {
        type: template.templateMediaType === 'video' ? 'video' : 'image',
        source: template.dataUrl,
        ...dimensions,
        opacity: placement?.opacity ?? 1,
        loop: true,
        audio: 'mute',
      };
      continue;
    }
    const width = category === 'border' ? 1 : (placement?.width ?? 80) / 100;
    const layer: RenderImageLayer = {
      id: `template-${category}-${template.id}`,
      type: template.templateMediaType === 'video' ? 'video' : 'image',
      source: template.dataUrl,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
      fit: 'stretch',
      rect:
        category === 'border'
          ? { x: 0, y: 0, width: 1, height: 1 }
          : {
              x: (placement?.x ?? 0) / 100,
              y: (placement?.y ?? 0) / 100,
              width,
              height: (((width * size.width) / size.height) * dimensions.height) / dimensions.width,
            },
      rotation: placement?.rotation ?? 0,
      opacity: placement?.opacity ?? 1,
      zIndex: placement?.zIndex ?? (category === 'border' ? 50 : category === 'headline' ? 30 : 20),
      visible: true,
    };
    spec.layers.push(layer);
    if (category === 'headline' && (item.headlineTextOverride || template.headlineText)) {
      const text = createTextLayer(`${layer.id}:text`);
      spec.layers.push({
        ...text,
        text: item.headlineTextOverride ?? template.headlineText ?? '',
        rect: { ...layer.rect, y: layer.rect.y + layer.rect.height * 0.25 },
        fontFamily: template.headlineFontFamily ?? text.fontFamily,
        fontSize: (template.headlineFontSize ?? 28) / 280,
        color: template.headlineColor ?? text.color,
        align: template.headlineAlign ?? text.align,
        rotation: layer.rotation,
        opacity: layer.opacity,
        zIndex: layer.zIndex + 1,
      });
    }
  }
  return spec;
}
