import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { LogoMatch } from './matching';
import { normalizeMarkText, ocrBoxes } from './ocrBoxes';
export async function createOcr(): Promise<Worker> {
  const base = new URL('./vision/', `${location.origin}/`).href;
  const worker = await createWorker(['eng', 'por', 'spa'], OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    workerBlobURL: false,
    cacheMethod: 'none',
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return worker;
}
async function recognizeText(worker: Worker, canvas: HTMLCanvasElement, target: string): Promise<LogoMatch[]> {
  if (normalizeMarkText(target).length < 3) throw new Error('Informe ao menos três letras ou números da marca.');
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  return ocrBoxes(
    (data.blocks || []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)),
    canvas.width,
    canvas.height,
    target,
  );
}

/** Logos often sit on dark plates: isolate light/dark lettering so page binarization does not discard the plate. */
export async function findText(worker: Worker, canvas: HTMLCanvasElement, target: string): Promise<LogoMatch[]> {
  const original = await recognizeText(worker, canvas, target);
  if (original.length) return original;
  for (const light of [false, true]) {
    const prepared = document.createElement('canvas');
    prepared.width = canvas.width;
    prepared.height = canvas.height;
    const context = prepared.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(canvas, 0, 0);
    const image = context.getImageData(0, 0, prepared.width, prepared.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const gray = image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114;
      const ink = image.data[i + 3] > 10 && (light ? gray > 185 : gray < 75);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = ink ? 0 : 255;
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const matches = await recognizeText(worker, prepared, target);
    if (matches.length) return matches;
  }
  return [];
}
