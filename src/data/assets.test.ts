import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetRef } from '../domain/models';
import { AssetManager } from './assets';
import { readBytes } from './storage';

vi.mock('./storage', () => ({ isNative: () => false, readBytes: vi.fn() }));
const asset = (id: string): AssetRef => ({
  id,
  relativePath: `${id}.png`,
  source: `${id}.png`,
  name: `${id}.png`,
  mimeType: 'image/png',
  kind: 'image',
});
beforeEach(() => {
  vi.mocked(readBytes).mockResolvedValue(new Uint8Array([1, 2, 3]));
  vi.spyOn(URL, 'revokeObjectURL');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('retenção de assets durante operações assíncronas', () => {
  it('mantém URLs ainda fora do workspace durante importação e preserva histórico após commit', async () => {
    const manager = new AssetManager();
    const oldUrl = await manager.resolve(asset('history'));
    manager.releaseUnused(new Set(['history']));
    const release = manager.retain();
    const newUrl = await manager.resolve(asset('incoming'));
    manager.releaseUnused(new Set(['history']));
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(newUrl);
    release(['incoming']);
    expect(manager.stable(newUrl)).toBe('asset:incoming');
    expect(manager.stable(oldUrl)).toBe('asset:history');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    manager.dispose();
  });

  it('libera URLs não confirmadas na falha sem interromper outra importação concorrente', async () => {
    const manager = new AssetManager();
    const releaseFirst = manager.retain();
    const releaseSecond = manager.retain();
    const failedUrl = await manager.resolve(asset('failed'));
    const committedUrl = await manager.resolve(asset('committed'));
    manager.releaseUnused(new Set());
    releaseFirst();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    releaseSecond(['committed']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(failedUrl);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(committedUrl);
    releaseSecond();
    manager.releaseUnused(new Set());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(committedUrl);
  });

  it('encerramento sempre libera URLs, inclusive quando resta uma operação em andamento', async () => {
    const manager = new AssetManager();
    const release = manager.retain();
    const url = await manager.resolve(asset('pending'));
    manager.dispose();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    release(['pending']);
    expect(() => manager.retain()).toThrow('encerrado');
  });
});
