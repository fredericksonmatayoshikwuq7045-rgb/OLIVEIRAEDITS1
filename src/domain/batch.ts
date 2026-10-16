import type { MediaItem, MixMode } from './models';

export interface FilenameContext {
  conta: string;
  slot: number;
  n: number;
  original: string;
  aspect: string;
  date?: Date;
}
export function safeFilename(value: string): string {
  const result = Array.from(value.normalize('NFC'), (char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!result) return 'arquivo';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result) ? `_${result}` : result;
}
export function outputFilename(pattern: string, context: FilenameContext, extension: string): string {
  const date = context.date ?? new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const values: Record<string, string> = {
    conta: context.conta,
    slot: pad(context.slot),
    n: pad(context.n),
    data: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hora: `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`,
    original: context.original.replace(/\.[^.]+$/, ''),
    aspect: context.aspect.replace(':', 'x'),
  };
  const name = pattern.replace(/\{(conta|slot|n|data|hora|original|aspect)\}/g, (_match: string, key: string) => values[key]);
  return `${safeFilename(name).slice(0, 180)}.${extension.replace(/^\./, '').replace(/[^a-z0-9]/gi, '') || 'mp4'}`;
}
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
export function mixTemplateIds(ids: readonly string[], count: number, mode: MixMode, seed = 1): string[] {
  const unique = [...new Set(ids)];
  if (!unique.length || count <= 0) return [];
  const random = seededRandom(seed);
  const output: string[] = [];
  for (let index = 0; index < Math.floor(count); index++) {
    if (mode === 'fixed') output.push(unique[0]);
    else if (mode === 'sequential') output.push(unique[index % unique.length]);
    else {
      const candidates = mode === 'no-repeat' && unique.length > 1 ? unique.filter((id) => id !== output.at(-1)) : unique;
      output.push(candidates[Math.floor(random() * candidates.length)]);
    }
  }
  return output;
}
export function parseHeadlines(text: string): string[] {
  const lines: string[] = [];
  let field = '',
    quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (field.trim()) lines.push(field.trim());
      field = '';
      if (char === '\r' && text[index + 1] === '\n') index++;
    } else field += char;
  }
  if (field.trim()) lines.push(field.trim());
  return lines;
}
export function trimItems(items: MediaItem[], start: number, end: number, maxDuration?: number): MediaItem[] {
  return items.map((item) => {
    if (item.kind !== 'video' || !item.probe) return item;
    const trimIn = Math.min(Math.max(0, start), Math.max(0, item.probe.duration - 0.001));
    let trimOut = Math.max(trimIn + 0.001, item.probe.duration - Math.max(0, end));
    if (maxDuration !== undefined && maxDuration > 0) trimOut = Math.min(trimOut, trimIn + maxDuration);
    return { ...item, trim: { in: trimIn, out: Math.min(item.probe.duration, trimOut) } };
  });
}
export function copyFraming(source: MediaItem, target: MediaItem, relative = true): MediaItem {
  const original = target.render.media;
  const media = { ...source.render.media, source: original.source, type: original.type, width: original.width, height: original.height };
  if (!relative) {
    media.pan = {
      x: (media.pan.x * source.render.canvas.width) / target.render.canvas.width,
      y: (media.pan.y * source.render.canvas.height) / target.render.canvas.height,
    };
    media.crop = {
      x: (media.crop.x * source.render.media.width) / Math.max(1, original.width),
      y: (media.crop.y * source.render.media.height) / Math.max(1, original.height),
      width: Math.min(1, (media.crop.width * source.render.media.width) / Math.max(1, original.width)),
      height: Math.min(1, (media.crop.height * source.render.media.height) / Math.max(1, original.height)),
    };
  }
  return { ...target, render: { ...target.render, media } };
}
export function rangeSelection(ids: string[], anchor: string, end: string): string[] {
  const first = ids.indexOf(anchor),
    last = ids.indexOf(end);
  return first < 0 || last < 0 ? [end] : ids.slice(Math.min(first, last), Math.max(first, last) + 1);
}

export type MediaSort = 'name' | 'date' | 'size';
export function sortMedia(items: MediaItem[], order: MediaSort): MediaItem[] {
  return [...items]
    .sort((left, right) =>
      order === 'name'
        ? left.title.localeCompare(right.title, 'pt-BR', { numeric: true, sensitivity: 'base' })
        : order === 'size'
          ? (right.probe?.sizeBytes ?? 0) - (left.probe?.sizeBytes ?? 0)
          : (right.probe?.modifiedAt ?? 0) - (left.probe?.modifiedAt ?? 0),
    )
    .map((item, index) => ({ ...item, slot: index + 1 }));
}
