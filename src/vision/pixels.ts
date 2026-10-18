export interface PixelFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export async function loadFrame(url: string, maxWidth = 960): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.min(maxWidth, image.naturalWidth));
  canvas.height = Math.max(1, Math.round((canvas.width * image.naturalHeight) / image.naturalWidth));
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
export function pixels(canvas: HTMLCanvasElement): PixelFrame {
  return canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
}
