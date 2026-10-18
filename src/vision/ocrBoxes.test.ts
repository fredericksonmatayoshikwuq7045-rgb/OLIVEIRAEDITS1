import { describe, expect, it } from 'vitest';
import { ocrBoxes } from './ocrBoxes';
const word = (text: string, x0: number, y0: number) => ({ text, confidence: 96, bbox: { x0, y0, x1: x0 + 40, y1: y0 + 20 } });
describe('localização de marcas escritas', () => {
  it('junta duas linhas de uma marca, ignora acentos e não duplica a mesma detecção', () => {
    const lines = [
      { bbox: { x0: 20, y0: 10, x1: 110, y1: 30 }, words: [word('VOCÊ', 20, 10), word('TEM', 70, 10)] },
      { bbox: { x0: 20, y0: 35, x1: 110, y1: 55 }, words: [word('UM', 20, 35), word('GÊMIO', 70, 35)] },
    ];
    const matches = ocrBoxes(lines, 200, 100, 'voce tem um gemio');
    expect(matches).toHaveLength(1);
    expect(matches[0].rect).toEqual({ x: 0.1, y: 0.1, width: 0.45, height: 0.45 });
  });
  it('preserva duas ocorrências diferentes para que a interface exija revisão', () => {
    const matches = ocrBoxes(
      [
        { bbox: { x0: 20, y0: 10, x1: 60, y1: 30 }, words: [word('MARCA', 20, 10)] },
        { bbox: { x0: 120, y0: 70, x1: 160, y1: 90 }, words: [word('MARCA', 120, 70)] },
      ],
      200,
      100,
      '@marca',
    );
    expect(matches).toHaveLength(2);
  });
});
