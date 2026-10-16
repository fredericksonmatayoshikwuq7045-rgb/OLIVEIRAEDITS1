import { describe, expect, it } from 'vitest';
import { canvasToSource, computeGeometry, sourceToCanvas } from './geometry';
import { createRenderSpec, OUTPUT_SIZES } from './types';

describe('canonical framing geometry', () => {
  for (const [aspect, canvas] of Object.entries(OUTPUT_SIZES)) {
    for (const [shape, source] of Object.entries({ vertical: [1080, 1920], horizontal: [1920, 1080], square: [1080, 1080] })) {
      it(`${aspect} / ${shape}: contain keeps the whole media, cover fills output`, () => {
        const spec = createRenderSpec(canvas.width, canvas.height);
        [spec.media.width, spec.media.height] = source;
        const contained = computeGeometry(spec);
        expect(contained.drawRect.width).toBeLessThanOrEqual(canvas.width + 1);
        expect(contained.drawRect.height).toBeLessThanOrEqual(canvas.height + 1);
        expect(
          Math.min(Math.abs(contained.drawRect.width - canvas.width), Math.abs(contained.drawRect.height - canvas.height)),
        ).toBeLessThanOrEqual(1);
        spec.media.fit = 'cover';
        const covered = computeGeometry(spec);
        expect(covered.drawRect.width).toBeGreaterThanOrEqual(canvas.width - 1);
        expect(covered.drawRect.height).toBeGreaterThanOrEqual(canvas.height - 1);
        expect(covered.drawRect.x + covered.drawRect.width / 2).toBe(canvas.width / 2);
        expect(covered.drawRect.y + covered.drawRect.height / 2).toBe(canvas.height / 2);
      });
    }
  }

  it('crop uses source pixels before fitting; zoom and pan are canvas fractions', () => {
    const spec = createRenderSpec(1000, 1000);
    spec.media.width = 2000;
    spec.media.height = 1000;
    spec.media.crop = { x: 0.25, y: 0, width: 0.5, height: 1 };
    spec.media.zoom = 1.5;
    spec.media.pan = { x: 0.1, y: -0.2 };
    const geometry = computeGeometry(spec);
    expect(geometry.sourceCrop).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
    expect(geometry.drawRect).toEqual({ x: -150, y: -450, width: 1500, height: 1500 });
    expect(sourceToCanvas(geometry, { x: 500, y: 500 })).toEqual({ x: 600, y: 300 });
  });

  for (const [rotation, corner] of [
    [0, [0, 250]],
    [90, [750, 0]],
    [180, [1000, 750]],
    [270, [250, 1000]],
  ] as const) {
    it(`rotates clockwise ${rotation} around the media center`, () => {
      const spec = createRenderSpec(1000, 1000);
      spec.media.width = 1000;
      spec.media.height = 500;
      spec.media.rotation = rotation;
      const geometry = computeGeometry(spec);
      const actual = sourceToCanvas(geometry, { x: 0, y: 0 });
      expect(actual.x).toBeCloseTo(corner[0]);
      expect(actual.y).toBeCloseTo(corner[1]);
      const expectedBounds = rotation % 180 === 0 ? { x: 0, y: 250, width: 1000, height: 500 } : { x: 250, y: 0, width: 500, height: 1000 };
      expect(geometry.bounds).toEqual(expectedBounds);
    });
  }

  it('flip H/V and arbitrary rotation remain invertible', () => {
    const spec = createRenderSpec(1080, 1920);
    spec.media.width = 1920;
    spec.media.height = 1080;
    spec.media.rotation = 37;
    spec.media.flipH = true;
    spec.media.flipV = true;
    const geometry = computeGeometry(spec);
    const original = { x: 710, y: 295 };
    const actual = canvasToSource(geometry, sourceToCanvas(geometry, original));
    expect(actual.x).toBeCloseTo(original.x);
    expect(actual.y).toBeCloseTo(original.y);
  });

  it('each flip reflects source points across the media center', () => {
    const spec = createRenderSpec(1000, 1000);
    spec.media.width = 1000;
    spec.media.height = 500;
    spec.media.flipH = true;
    expect(sourceToCanvas(computeGeometry(spec), { x: 0, y: 0 })).toEqual({ x: 1000, y: 250 });
    spec.media.flipH = false;
    spec.media.flipV = true;
    expect(sourceToCanvas(computeGeometry(spec), { x: 0, y: 0 })).toEqual({ x: 0, y: 750 });
  });

  it('circle follows the transformed media rather than the output frame', () => {
    const spec = createRenderSpec(1080, 1920);
    spec.media.width = 1920;
    spec.media.height = 1080;
    spec.media.mask = 'circle';
    spec.media.pan = { x: 0.1, y: 0.1 };
    expect(computeGeometry(spec).circle).toEqual({ center: { x: 648, y: 1152 }, radius: 304 });
  });

  it('original keeps pixel scale, stretch ignores aspect and blur uses contain', () => {
    const spec = createRenderSpec(1080, 1920);
    spec.media.width = 640;
    spec.media.height = 480;
    spec.media.fit = 'original';
    expect(computeGeometry(spec).drawRect).toMatchObject({ width: 640, height: 480 });
    spec.media.fit = 'stretch';
    expect(computeGeometry(spec).drawRect).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
    spec.media.fit = 'contain';
    const contained = computeGeometry(spec);
    spec.media.fit = 'blur';
    expect(computeGeometry(spec)).toEqual(contained);
  });

  it('bounds corrupt crop values and rejects non-finite transformations', () => {
    const spec = createRenderSpec(1080, 1920);
    spec.media.crop = { x: -2, y: 0.9, width: 7, height: 5 };
    expect(computeGeometry(spec).sourceCrop).toEqual({ x: 0, y: 1728, width: 1080, height: 192 });
    spec.media.rotation = Number.NaN;
    expect(() => computeGeometry(spec)).toThrow('Dimensões');
  });
});
