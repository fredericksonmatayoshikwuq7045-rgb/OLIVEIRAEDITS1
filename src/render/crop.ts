import { canvasToSource, computeGeometry, normalizeCrop, sourceToCanvas } from './geometry';
import type { Point, Rect, RenderGeometry, RenderSpec } from './types';

export interface CropSelection {
  previewSpec: RenderSpec;
  geometry: RenderGeometry;
  rect: Rect;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

/** Editing shows the whole source; selecting a crop never refits the moving handles. */
export function cropSelectionGeometry(spec: RenderSpec): CropSelection {
  const previewSpec: RenderSpec = { ...spec, media: { ...spec.media, fit: 'contain', crop: { x: 0, y: 0, width: 1, height: 1 } } };
  const geometry = computeGeometry(previewSpec);
  const crop = normalizeCrop(spec.media.crop);
  const width = geometry.drawRect.width * crop.width;
  const height = geometry.drawRect.height * crop.height;
  const center = sourceToCanvas(geometry, {
    x: (crop.x + crop.width / 2) * spec.media.width,
    y: (crop.y + crop.height / 2) * spec.media.height,
  });
  return {
    previewSpec,
    geometry,
    rect: { x: center.x - width / 2, y: center.y - height / 2, width, height },
    rotation: spec.media.rotation,
    flipH: spec.media.flipH,
    flipV: spec.media.flipV,
  };
}

/** Convert an output-pixel drag into normalized source movement, including flips/rotation. */
export function cropSourceDelta(spec: RenderSpec, canvasDelta: Point): Point {
  const { geometry } = cropSelectionGeometry(spec);
  const origin = canvasToSource(geometry, { x: 0, y: 0 });
  const target = canvasToSource(geometry, canvasDelta);
  return { x: (target.x - origin.x) / spec.media.width, y: (target.y - origin.y) / spec.media.height };
}
