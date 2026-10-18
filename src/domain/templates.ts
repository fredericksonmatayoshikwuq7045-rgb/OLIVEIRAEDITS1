import { createTextLayer } from '../render/types';
import type { AccountTemplate, MediaItem, TemplateCategory } from './models';

export function applyTemplate(item: MediaItem, template: AccountTemplate | null, category: TemplateCategory, append = false): MediaItem {
  const previous = item.templates[category];
  const prefix = `template:${category}:`;
  const legacyPrefix = `template-${category}-`;
  const layers = item.render.layers.filter(
    (layer) => append || (!layer.id.startsWith(prefix) && !layer.id.startsWith(legacyPrefix) && layer.id !== previous),
  );
  const render = { ...item.render, layers };
  if (category === 'background') {
    render.background = template
      ? {
          type: template.mediaType ?? 'image',
          source: template.runtimeUrl ?? template.source,
          width: template.sourceWidth ?? item.render.canvas.width,
          height: template.sourceHeight ?? item.render.canvas.height,
          opacity: template.placement.opacity,
          loop: true,
          audio: 'mute',
          sourceDuration: template.sourceDuration,
        }
      : { type: 'solid', color: '#111111' };
    return { ...item, templates: { ...item.templates, background: template?.id ?? null }, render };
  }
  if (template) {
    const layerId = `${prefix}${template.id}${append ? `:copy:${crypto.randomUUID()}` : ''}`;
    const placement = template.placement;
    const source = template.runtimeUrl ?? template.source;
    const sourceWidth = template.sourceWidth ?? item.render.canvas.width;
    const sourceHeight = template.sourceHeight ?? item.render.canvas.height;
    const rect = {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height:
        category === 'border'
          ? 1
          : (((placement.width * item.render.canvas.width) / item.render.canvas.height) * sourceHeight) / sourceWidth,
    };
    layers.push({
      id: layerId,
      type: template.mediaType ?? 'image',
      source,
      rect,
      rotation: placement.rotation,
      opacity: placement.opacity,
      zIndex: placement.zIndex,
      visible: true,
      fit: category === 'border' ? 'stretch' : 'contain',
      sourceWidth,
      sourceHeight,
      sourceDuration: template.sourceDuration,
      loop: category !== 'headline',
      audio: category === 'headline' ? 'mix' : 'mute',
      ...(category === 'headline' && template.mediaType === 'video' && template.sourceDuration
        ? { enable: { start: 0, end: template.sourceDuration } }
        : {}),
    });
    if (category === 'headline' && template.headlineText) {
      const text = createTextLayer(`${layerId}:text`);
      layers.push({
        ...text,
        text: item.headlineText ?? template.headlineText,
        rect: { ...rect, y: rect.y + rect.height * 0.25 },
        fontFamily: template.headlineFontFamily || text.fontFamily,
        fontSize: template.headlineFontSize ? template.headlineFontSize / item.render.canvas.height : text.fontSize,
        color: template.headlineColor || text.color,
        align: template.headlineAlign || text.align,
        zIndex: placement.zIndex + 1,
        enable: layers[layers.length - 1].enable,
      });
    }
  }
  return { ...item, templates: { ...item.templates, [category]: template?.id ?? null }, render };
}
export function removeTemplateReferences(item: MediaItem, templateId: string): MediaItem {
  const templates = { ...item.templates };
  for (const category of ['border', 'watermark', 'headline', 'background'] as const) {
    if (templates[category] === templateId) templates[category] = null;
  }
  return {
    ...item,
    templates,
    render: {
      ...item.render,
      layers: item.render.layers.filter((layer) => !layer.id.includes(templateId)),
      background: item.templates.background === templateId ? { type: 'solid', color: '#111111' } : item.render.background,
    },
  };
}
