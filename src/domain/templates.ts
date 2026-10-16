import { createTextLayer } from '../render/types';
import type { AccountTemplate, MediaItem, TemplateCategory } from './models';

export function applyTemplate(item: MediaItem, template: AccountTemplate | null, category: TemplateCategory): MediaItem {
  const previous = item.templates[category];
  const prefix = `template:${category}:`;
  const legacyPrefix = `template-${category}-`;
  const layers = item.render.layers.filter(
    (layer) => !layer.id.startsWith(prefix) && !layer.id.startsWith(legacyPrefix) && layer.id !== previous,
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
        }
      : { type: 'solid', color: '#111111' };
    return { ...item, templates: { ...item.templates, background: template?.id ?? null }, render };
  }
  if (template) {
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
      id: `${prefix}${template.id}`,
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
    });
    if (category === 'headline' && template.headlineText) {
      const text = createTextLayer(`${prefix}${template.id}:text`);
      layers.push({
        ...text,
        text: item.headlineText ?? template.headlineText,
        rect: { ...rect, y: rect.y + rect.height * 0.25 },
        fontFamily: template.headlineFontFamily || text.fontFamily,
        fontSize: template.headlineFontSize ? template.headlineFontSize / item.render.canvas.height : text.fontSize,
        color: template.headlineColor || text.color,
        align: template.headlineAlign || text.align,
        zIndex: placement.zIndex + 1,
      });
    }
  }
  return { ...item, templates: { ...item.templates, [category]: template?.id ?? null }, render };
}
export function removeTemplateReferences(item: MediaItem, templateId: string): MediaItem {
  let result = item;
  for (const category of ['border', 'watermark', 'headline', 'background'] as const) {
    if (result.templates[category] === templateId) result = applyTemplate(result, null, category);
  }
  return result;
}
