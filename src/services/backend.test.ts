import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { mediaUrl } from './backend';
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => true),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
  invoke: vi.fn(),
}));
describe('native media URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });
  it('converts filesystem paths once, including Windows paths', () => {
    for (const path of ['/local/clip.mp4', 'C:\\Mídias\\clip.mp4']) {
      const url = mediaUrl(path);
      expect(url).toBe(`asset://localhost/${encodeURIComponent(path)}`);
      expect(mediaUrl(url)).toBe(url);
    }
    expect(convertFileSrc).toHaveBeenCalledTimes(2);
  });
  it('preserves native URLs, blobs and data used by preview and still export', () => {
    for (const url of [
      'asset://localhost/%2Flocal%2Fclip.mp4',
      'http://asset.localhost/C%3A%5Cclip.mp4',
      'blob:frame',
      'data:image/png;base64,AA',
      'https://example.test/clip.mp4',
    ])
      expect(mediaUrl(url)).toBe(url);
    expect(convertFileSrc).not.toHaveBeenCalled();
  });
  it('leaves browser paths unchanged', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    expect(mediaUrl('/local/clip.mp4')).toBe('/local/clip.mp4');
    expect(convertFileSrc).not.toHaveBeenCalled();
  });
});
