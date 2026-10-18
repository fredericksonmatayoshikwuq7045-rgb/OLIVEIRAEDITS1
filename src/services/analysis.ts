import type { MarkRule } from '../domain/automation';
import type { MediaItem, Profile } from '../domain/models';
import type { Rect } from '../render/types';
import { detectContent, stableContent } from '../vision/content';
import type { LogoMatch } from '../vision/matching';
import { createOcr, findText } from '../vision/ocr';
import { loadFrame, pixels, type PixelFrame } from '../vision/pixels';
import { sampleFrames } from './filmstrip';
export interface AnalysisResult {
  id: string;
  rect?: Rect;
  confidence: number;
  preview?: string;
  message: string;
  selected: boolean;
}
function aborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Análise cancelada.', 'AbortError');
}
async function logoMatch(frame: PixelFrame, reference: PixelFrame, signal: AbortSignal): Promise<LogoMatch | null> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../vision/matching.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      worker.terminate();
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      finish();
      reject(new DOMException('Análise cancelada.', 'AbortError'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    worker.onmessage = (event) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message));
    };
    worker.postMessage([frame, reference]);
  });
}
export async function analyzeMedia(
  items: MediaItem[],
  profile: Profile,
  type: 'crop' | 'mark',
  rule: MarkRule,
  signal: AbortSignal,
  progress: (completed: number, total: number) => void,
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [],
    ready = items.filter((item) => item.status === 'ready');
  let ocr: Awaited<ReturnType<typeof createOcr>> | undefined, reference: PixelFrame | undefined;
  try {
    if (type === 'mark' && rule.mode === 'text') ocr = await createOcr();
    if (type === 'mark' && rule.mode === 'image') {
      const asset = profile.assets.find((asset) => asset.id === rule.referenceAssetId);
      if (!asset?.runtimeUrl) throw new Error('Escolha uma imagem de referência disponível para a marca antiga.');
      reference = pixels(await loadFrame(asset.runtimeUrl, 170));
    }
    for (const item of ready) {
      aborted(signal);
      progress(results.length, ready.length);
      try {
        const frames = await sampleFrames(item, profile, item.kind === 'video' ? 5 : 1, true, type === 'mark' && ocr ? 1280 : 480),
          found: LogoMatch[] = [];
        const visible = (match: LogoMatch) => {
          const crop = item.render.media.crop,
            box = match.rect;
          const width = Math.max(0, Math.min(crop.x + crop.width, box.x + box.width) - Math.max(crop.x, box.x));
          const height = Math.max(0, Math.min(crop.y + crop.height, box.y + box.height) - Math.max(crop.y, box.y));
          return width * height >= box.width * box.height * 0.8;
        };
        let preview: string | undefined,
          ambiguous = false;
        for (const frame of frames) {
          aborted(signal);
          const canvas = await loadFrame(frame.url, type === 'crop' || reference ? 480 : 1280);
          preview ??= canvas.toDataURL('image/jpeg', 0.65);
          if (type === 'crop') {
            const content = detectContent(pixels(canvas));
            if (content) found.push(content);
          } else if (ocr) {
            const matches = await findText(ocr, canvas, rule.targetText);
            if (matches.length > 1) ambiguous = true;
            if (matches.length === 1 && visible(matches[0])) found.push(matches[0]);
          } else if (reference) {
            const match = await logoMatch(pixels(canvas), reference, signal);
            if (match && visible(match)) found.push(match);
          }
        }
        const detection = stableContent(found);
        const complete = found.length === frames.length;
        const confidence = detection ? detection.confidence * (complete ? 1 : 0.65) * (ambiguous ? 0.5 : 1) : 0;
        const unchanged = type === 'crop' && detection && detection.rect.width > 0.98 && detection.rect.height > 0.98;
        const selected = !!detection && confidence >= 0.88 && !unchanged;
        results.push({
          id: item.id,
          rect: detection?.rect,
          confidence,
          preview,
          selected,
          message: unchanged
            ? 'Sem moldura significativa para remover.'
            : ambiguous
              ? 'Mais de uma ocorrência do texto: revise manualmente.'
              : !detection
                ? 'Nenhuma região confiável encontrada.'
                : !complete
                  ? 'Detectada em parte das amostras; revisão necessária.'
                  : selected
                    ? 'Posição consistente nas amostras.'
                    : 'Posição ou aparência varia; confira antes de aplicar.',
        });
      } catch (error) {
        aborted(signal);
        results.push({ id: item.id, confidence: 0, selected: false, message: String(error) });
      }
      progress(results.length, ready.length);
    }
    return results;
  } finally {
    await ocr?.terminate();
  }
}
