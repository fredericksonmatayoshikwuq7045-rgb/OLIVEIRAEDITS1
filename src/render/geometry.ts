import type { Point, Rect, RenderGeometry, RenderSpec } from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const positiveEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);
const pixelFloor = (value: number) => Math.floor(value + 1e-7);
const finite = (values: number[]) => values.every(Number.isFinite);

export function normalizeCrop(crop: Rect): Rect {
  if (!finite([crop.x, crop.y, crop.width, crop.height])) throw new Error('Recorte inválido.');
  const x = clamp(crop.x, 0, 0.999999);
  const y = clamp(crop.y, 0, 0.999999);
  return { x, y, width: clamp(crop.width, 0.000001, 1 - x), height: clamp(crop.height, 0.000001, 1 - y) };
}

/** Canonical geometry for Canvas and FFmpeg. Crop → fit → zoom → flip → rotate → pan. */
export function computeGeometry(spec: RenderSpec): RenderGeometry {
  const { canvas, media } = spec;
  if (
    !finite([canvas.width, canvas.height, media.width, media.height, media.zoom, media.pan.x, media.pan.y, media.rotation]) ||
    Math.min(canvas.width, canvas.height, media.width, media.height, media.zoom) <= 0
  ) {
    throw new Error('Dimensões ou transformação inválidas.');
  }
  const crop = normalizeCrop(media.crop);
  const sourceCrop = {
    x: Math.min(pixelFloor(media.width * crop.x), media.width - 1),
    y: Math.min(pixelFloor(media.height * crop.y), media.height - 1),
    width: Math.max(1, pixelFloor(media.width * crop.width)),
    height: Math.max(1, pixelFloor(media.height * crop.height)),
  };
  sourceCrop.width = Math.min(sourceCrop.width, media.width - sourceCrop.x);
  sourceCrop.height = Math.min(sourceCrop.height, media.height - sourceCrop.y);
  let scaleX = canvas.width / sourceCrop.width;
  let scaleY = canvas.height / sourceCrop.height;
  if (media.fit !== 'stretch') {
    const scale = media.fit === 'original' ? 1 : media.fit === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
  }
  const width = positiveEven(sourceCrop.width * scaleX * media.zoom);
  const height = positiveEven(sourceCrop.height * scaleY * media.zoom);
  const center = { x: Math.round(canvas.width * (0.5 + media.pan.x)), y: Math.round(canvas.height * (0.5 + media.pan.y)) };
  const drawRect = { x: center.x - width / 2, y: center.y - height / 2, width, height };
  const radians = (media.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians)) < 1e-12 ? 0 : Math.cos(radians);
  const sin = Math.abs(Math.sin(radians)) < 1e-12 ? 0 : Math.sin(radians);
  const sx = (width / sourceCrop.width) * (media.flipH ? -1 : 1);
  const sy = (height / sourceCrop.height) * (media.flipV ? -1 : 1);
  const a = cos * sx,
    b = sin * sx,
    c = -sin * sy,
    d = cos * sy;
  const boundWidth = Math.ceil(Math.abs(cos) * width + Math.abs(sin) * height);
  const boundHeight = Math.ceil(Math.abs(sin) * width + Math.abs(cos) * height);
  return {
    sourceCrop,
    drawRect,
    bounds: { x: center.x - boundWidth / 2, y: center.y - boundHeight / 2, width: boundWidth, height: boundHeight },
    matrix: [
      a,
      b,
      c,
      d,
      center.x - (a * sourceCrop.width) / 2 - (c * sourceCrop.height) / 2,
      center.y - (b * sourceCrop.width) / 2 - (d * sourceCrop.height) / 2,
    ],
    circle: media.mask === 'circle' ? { center, radius: Math.min(width, height) / 2 } : null,
  };
}

export function sourceToCanvas(geometry: RenderGeometry, point: Point): Point {
  const [a, b, c, d, e, f] = geometry.matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

export function canvasToSource(geometry: RenderGeometry, point: Point): Point {
  const [a, b, c, d, e, f] = geometry.matrix;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-15) throw new Error('Transformação não invertível.');
  return { x: (d * (point.x - e) - c * (point.y - f)) / determinant, y: (-b * (point.x - e) + a * (point.y - f)) / determinant };
}
