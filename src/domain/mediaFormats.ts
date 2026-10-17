import type { MediaKind } from './models';

const video = ['mp4', 'm4v', 'mov', 'mkv', 'avi', 'webm', 'wmv', 'mpeg', 'mpg', 'mts', 'm2ts'];
const image = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'avif'];
export const mediaExtensions = [...video, ...image];
export function mediaKind(name: string): MediaKind | null {
  const extension = name.split('.').at(-1)?.toLowerCase() ?? '';
  if (!name.includes('.')) return null;
  return video.includes(extension) ? 'video' : image.includes(extension) ? 'image' : null;
}
