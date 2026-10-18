import type { Rect } from '../render/types';
import type { PixelFrame } from './pixels';
export interface LogoMatch {
  rect: Rect;
  confidence: number;
}
const gray = (frame: PixelFrame, x: number, y: number) => {
  const i = (y * frame.width + x) * 4;
  return frame.data[i] * 0.299 + frame.data[i + 1] * 0.587 + frame.data[i + 2] * 0.114;
};
/** Normalized correlation over sampled pixels; coarse scan followed by a local refinement. */
export function matchLogo(frame: PixelFrame, reference: PixelFrame): LogoMatch | null {
  let best = { score: -1, x: 0, y: 0, width: 0, height: 0 };
  for (const targetWidth of new Set([reference.width, 20, 30, 45, 65, 90, 125, 170])) {
    const width = Math.round(targetWidth),
      height = Math.round((width * reference.height) / reference.width);
    if (width > frame.width || height > frame.height || height < 4) continue;
    const samples: { x: number; y: number; value: number }[] = [];
    for (let y = 0; y < height; y += Math.max(1, Math.ceil(height / 12)))
      for (let x = 0; x < width; x += Math.max(1, Math.ceil(width / 16)))
        samples.push({
          x,
          y,
          value: gray(
            reference,
            Math.min(reference.width - 1, Math.floor((x / width) * reference.width)),
            Math.min(reference.height - 1, Math.floor((y / height) * reference.height)),
          ),
        });
    const mean = samples.reduce((sum, s) => sum + s.value, 0) / samples.length;
    const variance = samples.reduce((sum, s) => sum + (s.value - mean) ** 2, 0);
    if (variance < samples.length * 80) continue;
    const score = (x: number, y: number) => {
      let sum = 0,
        squared = 0,
        cross = 0;
      for (const sample of samples) {
        const value = gray(frame, x + sample.x, y + sample.y);
        sum += value;
        squared += value * value;
        cross += (sample.value - mean) * value;
      }
      const v = squared - (sum * sum) / samples.length;
      return v > 1 ? cross / Math.sqrt(v * variance) : -1;
    };
    const stride = targetWidth === reference.width ? 1 : Math.max(1, Math.floor(width / 16));
    let local = { score: -1, x: 0, y: 0 };
    for (let y = 0; y <= frame.height - height; y += stride)
      for (let x = 0; x <= frame.width - width; x += stride) {
        const value = score(x, y);
        if (value > local.score) local = { score: value, x, y };
      }
    const origin = { ...local };
    for (let y = Math.max(0, origin.y - stride); y <= Math.min(frame.height - height, origin.y + stride); y++)
      for (let x = Math.max(0, origin.x - stride); x <= Math.min(frame.width - width, origin.x + stride); x++) {
        const value = score(x, y);
        if (value > local.score) local = { score: value, x, y };
      }
    if (local.score > best.score) best = { ...local, width, height };
  }
  if (best.score < 0.7) return null;
  return {
    rect: { x: best.x / frame.width, y: best.y / frame.height, width: best.width / frame.width, height: best.height / frame.height },
    confidence: Math.min(1, best.score),
  };
}
