import type { LogoMatch } from './matching';
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Word {
  text: string;
  confidence: number;
  bbox: Box;
}
interface Line {
  words: Word[];
  bbox: Box;
}
export const normalizeMarkText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
export function ocrBoxes(lines: Line[], width: number, height: number, target: string): LogoMatch[] {
  const needle = normalizeMarkText(target),
    groups = lines.map((line) => line.words);
  for (const first of lines)
    for (const second of lines) {
      if (first === second || second.bbox.y0 < first.bbox.y0) continue;
      const rowHeight = Math.max(first.bbox.y1 - first.bbox.y0, second.bbox.y1 - second.bbox.y0);
      const overlap = Math.min(first.bbox.x1, second.bbox.x1) - Math.max(first.bbox.x0, second.bbox.x0);
      const gap = second.bbox.y0 - first.bbox.y1;
      if (gap <= rowHeight * 1.5 && (overlap > 0 || (Math.abs(gap) < rowHeight && second.bbox.x0 - first.bbox.x1 < rowHeight * 2)))
        groups.push([...first.words, ...second.words]);
    }
  const matches: LogoMatch[] = [];
  for (const words of groups)
    for (let start = 0; start < words.length; start++) {
      let text = '';
      for (let end = start; end < Math.min(words.length, start + 12); end++) {
        text += normalizeMarkText(words[end].text);
        if (text.length > needle.length + 3) break;
        if (text !== needle) continue;
        const selected = words.slice(start, end + 1),
          x = Math.min(...selected.map((word) => word.bbox.x0)),
          y = Math.min(...selected.map((word) => word.bbox.y0));
        const right = Math.max(...selected.map((word) => word.bbox.x1)),
          bottom = Math.max(...selected.map((word) => word.bbox.y1));
        const result = {
          rect: { x: x / width, y: y / height, width: (right - x) / width, height: (bottom - y) / height },
          confidence: Math.min(...selected.map((word) => word.confidence)) / 100,
        };
        if (!matches.some((match) => Math.abs(match.rect.x - result.rect.x) < 0.005 && Math.abs(match.rect.y - result.rect.y) < 0.005))
          matches.push(result);
        break;
      }
    }
  return matches;
}
