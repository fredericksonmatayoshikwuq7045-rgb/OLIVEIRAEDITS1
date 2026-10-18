import { describe, expect, it } from 'vitest';
import { createMediaItem } from './defaults';
import { canvasDetection, coverMark, defaultMarkRule } from './automation';
import { detectContent, stableContent } from '../vision/content';
import { matchLogo } from '../vision/matching';
import type { PixelFrame } from '../vision/pixels';
function frame(width: number, height: number, color: (x: number, y: number) => number): PixelFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = color(x, y);
      data[index + 3] = 255;
    }
  return { width, height, data };
}
describe('análise de molduras e marcas', () => {
  it('separa um título branco na faixa preta da área principal da cena', () => {
    const image = frame(200, 300, (x, y) => (y >= 80 && y < 220 ? 110 + (x % 60) : y > 20 && y < 35 && x > 30 && x < 170 ? 255 : 0));
    const detection = detectContent(image)!;
    expect(detection.rect.y).toBeCloseTo(79 / 300);
    expect(detection.rect.height).toBeCloseTo(142 / 300);
    expect(detection.confidence).toBeGreaterThan(0.88);
  });
  it('não considera uma imagem totalmente escura uma cena confiável e reduz confiança de quadros divergentes', () => {
    expect(detectContent(frame(100, 100, () => 0))).toBeNull();
    expect(
      stableContent([
        { rect: { x: 0, y: 0.2, width: 1, height: 0.5 }, confidence: 0.95 },
        { rect: { x: 0, y: 0.4, width: 1, height: 0.5 }, confidence: 0.95 },
      ])!.confidence,
    ).toBeLessThan(0.88);
  });
  it('encontra a mesma referência em posições diferentes e recusa uma referência uniforme', () => {
    const logo = frame(30, 15, (x, y) => ((x * 11 + y * 7) % 23) * 10);
    for (const [left, top] of [
      [24, 30],
      [100, 70],
      [101, 71],
    ]) {
      const image = frame(160, 100, (x, y) =>
        x >= left && x < left + 30 && y >= top && y < top + 15 ? logo.data[((y - top) * 30 + x - left) * 4] : 50,
      );
      const result = matchLogo(image, logo)!;
      expect(result.confidence).toBeGreaterThan(0.98);
      expect(result.rect.x).toBeCloseTo(left / 160);
    }
    expect(
      matchLogo(
        frame(160, 100, () => 100),
        frame(30, 15, () => 255),
      ),
    ).toBeNull();
  });
  it('mapeia a marca após crop/rotação e cria uma placa opaca independente da transparência da logo', () => {
    const item = createMediaItem('image', 1);
    item.render.media.width = 1080;
    item.render.media.height = 1920;
    const box = { x: 0.2, y: 0.3, width: 0.1, height: 0.05 };
    const mapped = canvasDetection(item, box, 0);
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(mapped[key]).toBeCloseTo(box[key], 10);
    const result = coverMark(item, box, { ...defaultMarkRule, replacementText: 'MINHA MARCA' }, 'data:image/png;base64,plate');
    expect(result.render.layers).toHaveLength(2);
    expect(result.render.layers[0]).toMatchObject({ type: 'image', fit: 'stretch', opacity: 1 });
    expect(item.render.layers).toHaveLength(0);
    expect(coverMark(result, box, { ...defaultMarkRule, replacementText: 'OUTRA' }, 'plate').render.layers).toHaveLength(2);
  });
});
