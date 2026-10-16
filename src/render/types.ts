export interface Size {
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Size, Point {}
export type FitMode = 'cover' | 'contain' | 'stretch' | 'original' | 'blur';
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

/** All positions are canvas fractions; crop is a fraction of the source. */
export interface RenderMedia extends Size {
  type: 'image' | 'video';
  source: string;
  fit: FitMode;
  crop: Rect;
  zoom: number;
  pan: Point;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  mask: 'none' | 'circle';
  opacity: number;
  zIndex: number;
}

export type RenderBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; from: string; to: string; angle: number }
  | { type: 'image' | 'video'; source: string; width: number; height: number; opacity: number; loop: boolean; audio: 'mute' | 'mix' }
  | { type: 'blur'; radius: number };

export interface LayerBase {
  id: string;
  rect: Rect;
  rotation: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  enable?: { start: number; end: number };
}

export interface RenderImageLayer extends LayerBase {
  type: 'image' | 'video';
  source: string;
  fit: 'cover' | 'contain' | 'stretch';
  sourceWidth: number;
  sourceHeight: number;
}

/** Font size is a canvas-height fraction; decoration sizes use min(W,H). */
export interface RenderTextLayer extends LayerBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
  lineHeight: number;
  background: { color: string; opacity: number; padding: number; radius: number };
  stroke: { color: string; width: number };
  shadow: { color: string; blur: number; offsetX: number; offsetY: number };
}

export type RenderLayer = RenderImageLayer | RenderTextLayer;
export interface RenderSpec {
  version: 1;
  canvas: Size;
  background: RenderBackground;
  media: RenderMedia;
  layers: RenderLayer[];
}

/** Matrix maps cropped source-local pixels to output pixels. */
export interface RenderGeometry {
  sourceCrop: Rect;
  drawRect: Rect;
  bounds: Rect;
  matrix: [number, number, number, number, number, number];
  circle: { center: Point; radius: number } | null;
}

export const OUTPUT_SIZES: Record<AspectRatio, Size> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

export function createRenderSpec(width = 1080, height = 1920, source = '', type: 'image' | 'video' = 'image'): RenderSpec {
  return {
    version: 1,
    canvas: { width, height },
    background: { type: 'solid', color: '#111111' },
    media: {
      type,
      source,
      width,
      height,
      fit: 'contain',
      crop: { x: 0, y: 0, width: 1, height: 1 },
      zoom: 1,
      pan: { x: 0, y: 0 },
      rotation: 0,
      flipH: false,
      flipV: false,
      mask: 'none',
      opacity: 1,
      zIndex: 10,
    },
    layers: [],
  };
}

export function createTextLayer(id: string = crypto.randomUUID()): RenderTextLayer {
  return {
    id,
    type: 'text',
    rect: { x: 0.05, y: 0.8, width: 0.9, height: 0.1 },
    text: '',
    fontFamily: 'sans-serif',
    fontSize: 0.045,
    bold: true,
    italic: false,
    align: 'center',
    color: '#ffffff',
    lineHeight: 1.2,
    rotation: 0,
    opacity: 1,
    zIndex: 40,
    visible: true,
    background: { color: '#000000', opacity: 0.6, padding: 0.012, radius: 0.01 },
    stroke: { color: '#000000', width: 0 },
    shadow: { color: '#00000000', blur: 0, offsetX: 0, offsetY: 0 },
  };
}
