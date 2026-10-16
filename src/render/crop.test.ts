import { describe, expect, it } from 'vitest';
import { cropSelectionGeometry, cropSourceDelta } from './crop';
import { createRenderSpec } from './types';

describe('crop editing source geometry', () => {
  it('shows full contained source instead of refitting each changing crop', () => {
    const spec = createRenderSpec(1000, 1000);
    spec.media.width = 2000;
    spec.media.height = 1000;
    spec.media.fit = 'cover';
    spec.media.crop = { x: 0.25, y: 0.1, width: 0.5, height: 0.8 };
    const selection = cropSelectionGeometry(spec);
    expect(selection.previewSpec.media.fit).toBe('contain');
    expect(selection.previewSpec.media.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(selection.rect).toEqual({ x: 250, y: 300, width: 500, height: 400 });
    expect(cropSourceDelta(spec, { x: 100, y: 50 })).toEqual({ x: 0.1, y: 0.1 });
    spec.media.crop.width = 0.6;
    expect(cropSelectionGeometry(spec).rect.x).toBe(250);
  });

  it('converts clockwise rotation and a horizontal flip back into source fractions', () => {
    const spec = createRenderSpec(1000, 1000);
    spec.media.width = 1000;
    spec.media.height = 1000;
    spec.media.rotation = 90;
    spec.media.flipH = true;
    const delta = cropSourceDelta(spec, { x: 100, y: 200 });
    expect(delta.x).toBeCloseTo(-0.2);
    expect(delta.y).toBeCloseTo(-0.1);
    spec.media.crop = { x: 0, y: 0, width: 0.5, height: 1 };
    expect(cropSelectionGeometry(spec).rect).toEqual({ x: 250, y: 250, width: 500, height: 1000 });
  });
});
