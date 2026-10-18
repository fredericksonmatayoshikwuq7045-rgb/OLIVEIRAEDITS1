import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { isNative } from './storage';
import { nativeMediaUrl } from './nativeMedia';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), convertFileSrc: vi.fn((path: string) => `asset:${path}`) }));
vi.mock('./storage', () => ({ isNative: vi.fn(() => true) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(invoke).mockReset();
  vi.mocked(isNative).mockReturnValue(true);
});
describe('desktop media transport', () => {
  it('requests authorized streaming for video and retains the platform fallback', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('http://127.0.0.1:1234/token').mockResolvedValueOnce(null);
    expect(await nativeMediaUrl('/clip.mp4', 'video')).toBe('http://127.0.0.1:1234/token');
    expect(invoke).toHaveBeenCalledWith('storage_media_url', { path: '/clip.mp4' });
    expect(await nativeMediaUrl('C:\\clip.mp4', 'video')).toBe('asset:C:\\clip.mp4');
  });
  it('uses the existing asset protocol for images and leaves browser sources unchanged', async () => {
    expect(await nativeMediaUrl('/photo.png', 'image')).toBe('asset:/photo.png');
    vi.mocked(isNative).mockReturnValue(false);
    expect(await nativeMediaUrl('blob:clip', 'video')).toBe('blob:clip');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('propagates authorization failure instead of falling back to an ungranted file', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Caminho não autorizado'));
    await expect(nativeMediaUrl('/private.mp4', 'video')).rejects.toThrow('não autorizado');
    expect(convertFileSrc).not.toHaveBeenCalled();
  });
});
