import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createMediaItem, createWorkspace } from '../domain/defaults';
import { AssetManager } from './assets';
import { isNative, pathExists } from './storage';
import { generateThumbnail } from './thumbnails';
import { dehydrateWorkspace, hydrateWorkspace } from './workspaceIO';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
  invoke: vi.fn(),
}));
vi.mock('./storage', () => ({ isNative: vi.fn(), pathExists: vi.fn() }));
vi.mock('./thumbnails', () => ({ generateThumbnail: vi.fn() }));

function fixture() {
  const workspace = createWorkspace();
  const item = createMediaItem('video', 1);
  item.sourcePath = '/media/original.mp4';
  item.status = 'ready';
  item.thumbnailUrl = 'asset://localhost/cache/deleted.jpg';
  item.probe = {
    path: item.sourcePath,
    width: 1920,
    height: 1080,
    duration: 10,
    fps: 30,
    codec: 'h264',
    pixFmt: 'yuv420p',
    rotation: 0,
    hasAudio: true,
    tags: {},
    sizeBytes: 1024,
    isImage: false,
  };
  workspace.projects[0].items.push(item);
  const manager = new AssetManager();
  vi.spyOn(manager, 'resolve').mockResolvedValue('blob:resolved-video');
  vi.spyOn(manager, 'loadFonts').mockResolvedValue();
  return { workspace, item, manager };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(invoke).mockReset();
  vi.mocked(isNative).mockReturnValue(true);
  vi.mocked(pathExists).mockResolvedValue(true);
  vi.mocked(generateThumbnail).mockResolvedValue('asset://localhost/cache/regenerated.jpg');
});

describe('miniaturas recuperáveis após limpar o cache', () => {
  it.each(['asset://localhost/cache/old.jpg', 'http://asset.localhost/cache/old.jpg', 'blob:old-preview'])(
    'não salva a referência temporária %s',
    (thumbnailUrl) => {
      const { workspace, item, manager } = fixture();
      item.thumbnailUrl = thumbnailUrl;
      expect(dehydrateWorkspace(workspace, manager).projects[0].items[0].thumbnailUrl).toBeUndefined();
      expect(item.thumbnailUrl).toBe(thumbnailUrl);
    },
  );

  it('preserva miniaturas incorporadas do navegador ao salvar e reabrir', async () => {
    vi.mocked(isNative).mockReturnValue(false);
    const { workspace, item, manager } = fixture();
    item.thumbnailUrl = 'data:image/jpeg;base64,cHJldmlldw==';
    item.assetId = 'asset-video';
    workspace.profiles[0].assets.push({
      id: item.assetId,
      name: 'original.mp4',
      source: 'original.mp4',
      relativePath: 'assets/original.mp4',
      kind: 'video',
      mimeType: 'video/mp4',
    });
    const stable = dehydrateWorkspace(workspace, manager);
    expect(stable.projects[0].items[0].thumbnailUrl).toBe(item.thumbnailUrl);
    const restored = await hydrateWorkspace(stable, manager);
    expect(restored.workspace.projects[0].items[0]).toMatchObject({ status: 'ready', thumbnailUrl: item.thumbnailUrl });
    expect(generateThumbnail).not.toHaveBeenCalled();
  });

  it('recupera projetos antigos com referência a um arquivo já apagado do cache', async () => {
    const { workspace, manager } = fixture();
    const restored = await hydrateWorkspace(workspace, manager);
    expect(restored.workspace.projects[0].items[0]).toMatchObject({
      status: 'ready',
      thumbnailUrl: 'asset://localhost/cache/regenerated.jpg',
    });
    expect(generateThumbnail).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }), '/media/original.mp4');
    expect(workspace.projects[0].items[0].thumbnailUrl).toBe('asset://localhost/cache/deleted.jpg');
  });

  it('consulta o cache nativo mesmo quando havia uma miniatura incorporada', async () => {
    const { workspace, item, manager } = fixture();
    item.thumbnailUrl = 'data:image/jpeg;base64,b2xk';
    await hydrateWorkspace(workspace, manager);
    expect(generateThumbnail).toHaveBeenCalledOnce();
  });

  it('usa o caminho do asset nativo quando o vídeo foi copiado para o perfil', async () => {
    const { workspace, item, manager } = fixture();
    item.sourcePath = null;
    item.assetId = 'asset-video';
    workspace.profiles[0].assets.push({
      id: item.assetId,
      name: 'original.mp4',
      source: '/profiles/assets/original.mp4',
      relativePath: 'profiles/assets/original.mp4',
      kind: 'video',
      mimeType: 'video/mp4',
    });
    await hydrateWorkspace(workspace, manager);
    expect(generateThumbnail).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }), '/profiles/assets/original.mp4');
  });

  it('mantém o vídeo disponível se não conseguir gerar a miniatura opcional', async () => {
    const { workspace, manager } = fixture();
    vi.mocked(generateThumbnail).mockRejectedValueOnce(new Error('cache indisponível'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const restored = await hydrateWorkspace(workspace, manager);
      expect(restored.workspace.projects[0].items[0]).toMatchObject({ status: 'ready', sourcePath: '/media/original.mp4' });
      expect(restored.workspace.projects[0].items[0].thumbnailUrl).toBeUndefined();
      expect(restored.workspace.projects[0].items[0].error).toBeUndefined();
    } finally {
      warning.mockRestore();
    }
  });

  it('não usa uma miniatura antiga para ocultar que a mídia está ausente', async () => {
    const { workspace, manager } = fixture();
    vi.mocked(pathExists).mockResolvedValue(false);
    const restored = await hydrateWorkspace(workspace, manager);
    expect(restored.workspace.projects[0].items[0]).toMatchObject({ status: 'missing', thumbnailUrl: undefined });
    expect(generateThumbnail).not.toHaveBeenCalled();
  });

  it('mantém o erro de um vídeo ilegível sem tentar gerar sua miniatura', async () => {
    const { workspace, item, manager } = fixture();
    item.probe = undefined;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'probe_media') throw new Error('vídeo corrompido');
      return null;
    });
    const restored = await hydrateWorkspace(workspace, manager);
    expect(restored.workspace.projects[0].items[0].status).toBe('error');
    expect(restored.workspace.projects[0].items[0].error).toContain('vídeo corrompido');
    expect(generateThumbnail).not.toHaveBeenCalled();
  });
});
