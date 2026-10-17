import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaExtensions } from '../domain/mediaFormats';
import { chooseMediaFiles, chooseMediaFolder } from './files';

const mocks = vi.hoisted(() => ({ open: vi.fn(), readDir: vi.fn(), nativeCall: vi.fn() }));
vi.mock('./backend', () => ({ isNative: () => true, nativeCall: mocks.nativeCall }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readDir: mocks.readDir }));
beforeEach(() => {
  vi.resetAllMocks();
});
describe('seleção de mídias no desktop', () => {
  it('seleciona uma pasta uma vez, autoriza o diretório e entrega todos os formatos em ordem natural', async () => {
    mocks.open.mockResolvedValue('C:\\Mídias\\');
    mocks.readDir.mockResolvedValue([
      { name: 'clip10.MTS', isFile: true },
      { name: 'clip2.m2ts', isFile: true },
      { name: 'clip1.AVIF', isFile: true },
      { name: 'notas.txt', isFile: true },
      { name: 'subpasta.mp4', isFile: false },
    ]);
    await expect(chooseMediaFolder()).resolves.toEqual(['C:\\Mídias/clip1.AVIF', 'C:\\Mídias/clip2.m2ts', 'C:\\Mídias/clip10.MTS']);
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith({ directory: true, title: 'Importar pasta de mídias' });
    expect(mocks.nativeCall).toHaveBeenCalledExactlyOnceWith('storage_authorize_paths', { paths: ['C:\\Mídias\\'] });
    expect(mocks.readDir).toHaveBeenCalledExactlyOnceWith('C:\\Mídias\\');
  });
  it('bloqueia outro seletor até o primeiro fechar e libera após cancelar', async () => {
    let cancel!: (value: null) => void;
    mocks.open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          cancel = resolve;
        }),
    );
    const pending = chooseMediaFolder();
    await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1));
    await expect(chooseMediaFiles()).resolves.toEqual([]);
    expect(mocks.open).toHaveBeenCalledTimes(1);
    cancel(null);
    await expect(pending).resolves.toEqual([]);
    mocks.open.mockResolvedValue(null);
    await expect(chooseMediaFiles()).resolves.toEqual([]);
    expect(mocks.open).toHaveBeenCalledTimes(2);
    expect(mocks.readDir).not.toHaveBeenCalled();
  });
  it('libera seleção após erro ao ler pasta e mantém todos os formatos no seletor de arquivos', async () => {
    mocks.open.mockResolvedValueOnce('/midias');
    mocks.readDir.mockRejectedValueOnce(new Error('Pasta indisponível'));
    await expect(chooseMediaFolder()).rejects.toThrow('Pasta indisponível');
    mocks.open.mockResolvedValueOnce(['/foto.avif', '/video.wmv']);
    await expect(chooseMediaFiles()).resolves.toEqual(['/foto.avif', '/video.wmv']);
    expect(mocks.open).toHaveBeenLastCalledWith({
      multiple: true,
      title: 'Importar vídeos e imagens',
      filters: [{ name: 'Mídias', extensions: mediaExtensions }],
    });
  });
});
