import { describe, expect, it } from 'vitest';
import { createMediaItem } from '../domain/defaults';
import { computeGeometry } from './geometry';
import { transformSelection } from './transform';
describe('transformação pela alça do player', () => {
  it('redimensiona sem alterar crop e mantém o canto oposto ancorado', () => {
    const item = createMediaItem('image', 1);
    item.render.media.width = 1080;
    item.render.media.height = 1920;
    const previous = computeGeometry(item.render).drawRect;
    const next = transformSelection(item, null, 'se', { x: 108, y: 192 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    const current = computeGeometry(next.render).drawRect;
    expect(next.render.media.zoom).toBeCloseTo(1.1);
    expect(current.x).toBeCloseTo(previous.x);
    expect(current.y).toBeCloseTo(previous.y);
    expect(next.render.media.crop).toEqual(item.render.media.crop);
  });
});
