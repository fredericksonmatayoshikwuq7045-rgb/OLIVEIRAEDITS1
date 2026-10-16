import type { ImageItem, TemplateItem, TextLayer, VideoItem } from '../types';
import { DEFAULT_TEMPLATE_PLACEMENTS, EMPTY_APPLIED_TEMPLATES } from '../types';

export type LegacyRecord = Record<string, unknown>;
export function object(value: unknown): LegacyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as LegacyRecord) : {};
}
export function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
export function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function normalizeLegacyItem(raw: unknown, index: number, kind: 'image' | 'video'): VideoItem | ImageItem {
  const value = object(raw);
  const ratio = value.aspectRatio;
  const applied = object(value.templates);
  const templates = EMPTY_APPLIED_TEMPLATES();
  for (const key of ['border', 'watermark', 'headline', 'background'] as const) templates[key] = string(applied[key]) || null;
  if (!value.templates && typeof value.templateId === 'string') templates.border = value.templateId;
  const defaults = DEFAULT_TEMPLATE_PLACEMENTS();
  const placements = object(value.templatePlacements);
  for (const key of ['border', 'watermark', 'headline', 'background', 'media'] as const) {
    const old = object(placements[key]);
    const base = defaults[key] ?? defaults.border;
    defaults[key] = {
      x: number(old.x, base.x),
      y: number(old.y, base.y),
      width: number(old.width, base.width),
      rotation: number(old.rotation, base.rotation ?? 0),
      opacity: number(old.opacity, base.opacity ?? 1),
      zIndex: number(old.zIndex, base.zIndex ?? 10),
    };
  }
  const textLayers: TextLayer[] = Array.isArray(value.textLayers)
    ? value.textLayers.map((entry, layerIndex): TextLayer => {
        const text = object(entry);
        return {
          id: string(text.id, `legacy-text-${index}-${layerIndex}`),
          label: string(text.label, 'Texto'),
          text: string(text.text),
          fontFamily: string(text.fontFamily, 'sans-serif'),
          fontSize: number(text.fontSize, 28),
          color: string(text.color, '#ffffff'),
          bgColor: string(text.bgColor, '#000000'),
          bgOpacity: number(text.bgOpacity, 0.6),
          bold: Boolean(text.bold),
          italic: Boolean(text.italic),
          align: text.align === 'left' || text.align === 'right' ? text.align : ('center' as const),
          x: number(text.x, 5),
          y: number(text.y, 80),
          width: number(text.width, 90),
          visible: text.visible !== false,
          isGlobal: Boolean(text.isGlobal),
          zIndex: number(text.zIndex, 40),
        };
      })
    : [];
  const crop = object(value.mediaCrop);
  const base: ImageItem = {
    id: number(value.id, index + 1),
    title: string(value.title, `Slot ${index + 1}`),
    url: string(value.url) || null,
    fileObj: null,
    scale: number(value.scale, 1),
    cropX: number(value.cropX),
    cropY: number(value.cropY),
    rotation: number(value.rotation),
    aspectRatio: ratio === '16:9' || ratio === '1:1' || ratio === '4:5' ? ratio : '9:16',
    cropMask: value.cropMask === 'circle' ? 'circle' : 'default',
    flipH: Boolean(value.flipH),
    templates,
    templatePlacements: defaults,
    textLayers,
    status: 'idle',
    headlineTextOverride: string(value.headlineTextOverride),
    mediaCrop: { x: number(crop.x), y: number(crop.y), width: number(crop.width, 100), height: number(crop.height, 100) },
  };
  return kind === 'image'
    ? base
    : {
        ...base,
        duration: number(value.duration),
        trimIn: number(value.trimIn),
        trimOut: number(value.trimOut, number(value.duration)),
        thumbnailUrl: string(value.thumbnailUrl) || null,
      };
}
export function normalizeLegacyTemplate(raw: unknown, index: number): TemplateItem {
  const value = object(raw);
  const category = value.category;
  return {
    id: string(value.id, `legacy-template-${index}`),
    name: string(value.name, 'Template recuperado'),
    groupId: string(value.groupId),
    category: category === 'watermark' || category === 'headline' || category === 'background' ? category : 'border',
    dataUrl: string(value.dataUrl),
    type: value.type === 'image' ? 'image' : 'video',
    templateMediaType: value.templateMediaType === 'video' ? 'video' : 'image',
    headlineText: string(value.headlineText),
    headlineFontFamily: string(value.headlineFontFamily),
    headlineFontSize: number(value.headlineFontSize, 28),
    headlineColor: string(value.headlineColor, '#ffffff'),
    headlineAlign: value.headlineAlign === 'left' || value.headlineAlign === 'right' ? value.headlineAlign : 'center',
  };
}
