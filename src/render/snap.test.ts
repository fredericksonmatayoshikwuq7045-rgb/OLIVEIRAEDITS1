import { describe, expect, it } from 'vitest';
import { createRenderSpec } from './types';
import { snapMediaPan, snapRect } from './snap';

describe('alinhamento de bordas e centros', () => {
  it('alinha camadas pelo centro sem mudar dimensões', () => {
    expect(snapRect({ x: 0.302, y: 0.003, width: 0.4, height: 0.2 })).toEqual({ x: 0.3, y: 0, width: 0.4, height: 0.2 });
  });
  it('alinha borda direita e preserva movimentos distantes das guias', () => {
    const rect = snapRect({ x: 0.604, y: 0.123, width: 0.4, height: 0.2 });
    expect(rect.x).toBeCloseTo(0.6);
    expect(rect.y).toBe(0.123);
  });
  it('usa limites rotacionados para alinhar mídia às bordas do canvas', () => {
    const spec = createRenderSpec(1000, 1000);
    spec.media.width = 1000;
    spec.media.height = 500;
    spec.media.rotation = 90;
    const pan = snapMediaPan(spec, { x: -0.247, y: 0.003 });
    expect(pan.x).toBeCloseTo(-0.25);
    expect(pan.y).toBeCloseTo(0);
  });
});
