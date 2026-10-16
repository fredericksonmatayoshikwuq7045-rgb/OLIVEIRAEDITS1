import type { RenderSpec, RenderTextLayer } from './types';

export function fontString(layer: RenderTextLayer, canvasHeight: number): string {
  const family = layer.fontFamily.replace(/["\\\r\n]/g, '');
  return `${layer.italic ? 'italic ' : ''}${layer.bold ? 900 : 400} ${layer.fontSize * canvasHeight}px "${family}", sans-serif`;
}

/** Breaks long words as well as paragraphs, using the actual loaded font metrics. */
export function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph.trim()) {
      result.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        result.push(line);
        line = '';
      }
      if (measure(word) <= maxWidth) {
        line = word;
        continue;
      }
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > maxWidth) {
          result.push(line);
          line = '';
        }
        line += character;
      }
    }
    result.push(line);
  }
  return result;
}

export async function prepareFonts(spec: RenderSpec): Promise<void> {
  const layers = spec.layers.filter((layer): layer is RenderTextLayer => layer.type === 'text' && layer.visible);
  if (!layers.length) return;
  await Promise.all(layers.map((layer) => document.fonts.load(fontString(layer, spec.canvas.height), layer.text || 'Aa')));
  await document.fonts.ready;
}

export interface TextLayout {
  lines: string[];
  width: number;
  height: number;
  padding: number;
  lineHeight: number;
  fontSize: number;
}

export function layoutText(context: CanvasRenderingContext2D, layer: RenderTextLayer, canvas: RenderSpec['canvas']): TextLayout {
  context.font = fontString(layer, canvas.height);
  const padding = Math.max(0, layer.background.padding * Math.min(canvas.width, canvas.height));
  const width = Math.max(1, layer.rect.width * canvas.width);
  const fontSize = Math.max(1, layer.fontSize * canvas.height);
  const lineHeight = Math.max(0.5, layer.lineHeight) * fontSize;
  const lines = wrapText(layer.text, Math.max(1, width - 2 * padding), (text) => context.measureText(text).width);
  return { lines, width, height: lines.length * lineHeight + 2 * padding, padding, lineHeight, fontSize };
}

export function drawText(context: CanvasRenderingContext2D, layer: RenderTextLayer, spec: RenderSpec): void {
  const layout = layoutText(context, layer, spec.canvas);
  const minSize = Math.min(spec.canvas.width, spec.canvas.height);
  const x = layer.rect.x * spec.canvas.width;
  const y = layer.rect.y * spec.canvas.height;
  context.save();
  context.translate(x + layout.width / 2, y + layout.height / 2);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.translate(-layout.width / 2, -layout.height / 2);
  context.globalAlpha = layer.opacity;
  if (layer.background.opacity > 0) {
    context.fillStyle = layer.background.color;
    context.globalAlpha = layer.opacity * layer.background.opacity;
    context.beginPath();
    context.roundRect(0, 0, layout.width, layout.height, Math.max(0, layer.background.radius * minSize));
    context.fill();
    context.globalAlpha = layer.opacity;
  }
  context.font = fontString(layer, spec.canvas.height);
  context.fillStyle = layer.color;
  context.textAlign = layer.align;
  context.textBaseline = 'top';
  context.lineJoin = 'round';
  context.lineWidth = layer.stroke.width * minSize;
  context.strokeStyle = layer.stroke.color;
  context.shadowColor = layer.shadow.color;
  context.shadowBlur = Math.max(0, layer.shadow.blur * minSize);
  context.shadowOffsetX = layer.shadow.offsetX * minSize;
  context.shadowOffsetY = layer.shadow.offsetY * minSize;
  const textX = layer.align === 'left' ? layout.padding : layer.align === 'right' ? layout.width - layout.padding : layout.width / 2;
  layout.lines.forEach((line, index) => {
    const textY = layout.padding + index * layout.lineHeight + (layout.lineHeight - layout.fontSize) / 2;
    if (context.lineWidth > 0) context.strokeText(line, textX, textY);
    context.fillText(line, textX, textY);
  });
  context.restore();
}
