import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMediaItem, createProject, createWorkspace } from '../domain/defaults';
import { mediaKind } from '../domain/mediaFormats';
import type { MediaProbe, Workspace } from '../domain/models';
import { AssetManager } from './assets';
import { mediaActions } from './mediaActions';
import { importMedia } from './mediaImport';
import type { WorkspaceContext } from './workspaceActions';

vi.mock('./mediaImport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./mediaImport')>()),
  importMedia: vi.fn(),
}));
const probe: MediaProbe = {
  path: 'source',
  width: 100,
  height: 200,
  duration: 3,
  fps: 30,
  codec: 'h264',
  pixFmt: 'yuv420p',
  rotation: 0,
  hasAudio: true,
  tags: {},
  sizeBytes: 30,
  isImage: false,
};
function imported(name: string) {
  const kind = mediaKind(name)!;
  const item = createMediaItem(kind, 0);
  Object.assign(item, { title: name, sourcePath: name, status: 'ready', thumbnailUrl: `thumbnail:${name}`, probe });
  Object.assign(item.render.media, { source: name, width: 100, height: 200 });
  return { item };
}
function setup() {
  let workspace = createWorkspace();
  const manager = new AssetManager();
  const context: WorkspaceContext = {
    get: () => workspace,
    update: (fn) => {
      workspace = fn(workspace);
    },
    manager: () => manager,
    warn: vi.fn(),
  };
  return {
    context,
    actions: mediaActions(context),
    get: () => workspace,
    set: (next: Workspace) => {
      workspace = next;
    },
  };
}
function deferred() {
  let finish!: () => void;
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(importMedia).mockImplementation(async (file) => imported(typeof file === 'string' ? file : file.name));
});

describe('importação em lote', () => {
  it('ordena naturalmente, preenche slots vazios e não cria lacunas quando um arquivo falha', async () => {
    const state = setup();
    const empty1 = createMediaItem('image', 1);
    const empty3 = createMediaItem('image', 3);
    const existing = { ...imported('existing.jpg').item, slot: 2 };
    state.get().projects[0].items = [empty1, existing, empty3];
    vi.mocked(importMedia).mockImplementation(async (name) => {
      if (name === 'bad.jpg') throw new Error('Arquivo corrompido');
      return imported(String(name));
    });
    const progress = vi.fn();
    const report = await state.actions.importFiles(['10.jpg', '2.jpg', 'bad.jpg', 'notes.txt'], progress);
    expect(report).toEqual({ imported: 2, failed: 1, ignored: 1 });
    const items = state.get().projects[0].items;
    expect(items.map((item) => [item.slot, item.title])).toEqual([
      [1, '2.jpg'],
      [2, 'existing.jpg'],
      [3, '10.jpg'],
    ]);
    expect(items[0].id).toBe(empty1.id);
    expect(items[2].id).toBe(empty3.id);
    expect(items[1]).toBe(existing);
    expect(progress.mock.calls.map(([value]) => value)).toEqual([
      { completed: 0, total: 3 },
      { completed: 1, total: 3 },
      { completed: 2, total: 3 },
      { completed: 3, total: 3 },
    ]);
    expect(state.context.warn).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining('Arquivo corrompido')]));
  });

  it('duas importações concorrentes usam slots distintos mesmo quando terminam fora de ordem', async () => {
    const state = setup();
    const pending = deferred();
    vi.mocked(importMedia).mockImplementation(async (name) => {
      if (name === 'slow.jpg') await pending.promise;
      return imported(String(name));
    });
    const first = state.actions.importFiles(['slow.jpg']);
    await mediaActions(state.context).importFiles(['fast.jpg']);
    pending.finish();
    await first;
    expect(state.get().projects[0].items.map((item) => [item.slot, item.title])).toEqual([
      [1, 'fast.jpg'],
      [2, 'slow.jpg'],
    ]);
  });

  it('mantém o projeto de destino ao trocar de projeto durante a leitura', async () => {
    const state = setup();
    const pending = deferred();
    vi.mocked(importMedia).mockImplementation(async () => {
      await pending.promise;
      return imported('photo.jpg');
    });
    const firstProject = state.get().projects[0];
    const secondProject = createProject(firstProject.profileId);
    const operation = state.actions.importFiles(['photo.jpg']);
    state.set({
      ...state.get(),
      projects: [firstProject, secondProject],
      activeProjectByProfile: { [firstProject.profileId]: secondProject.id },
    });
    pending.finish();
    await operation;
    expect(state.get().projects[0].items[0].title).toBe('photo.jpg');
    expect(state.get().projects[1].items).toEqual([]);
  });

  it('informa quando o projeto foi excluído antes do fim sem anexar assets a outra conta', async () => {
    const state = setup();
    const pending = deferred();
    vi.mocked(importMedia).mockImplementation(async () => {
      await pending.promise;
      return imported('photo.jpg');
    });
    const operation = state.actions.importFiles(['photo.jpg']);
    state.set({ ...state.get(), projects: [] });
    pending.finish();
    await expect(operation).rejects.toThrow('projeto de destino foi removido');
    expect(state.get().profiles[0].assets).toEqual([]);
  });
});

describe('vinculação de mídia', () => {
  it('renova nome e miniatura, preserva edições atuais e ajusta trim de uma fonte mais curta', async () => {
    const state = setup();
    const item = imported('old.mp4').item;
    Object.assign(item, { status: 'missing', trim: { in: 8, out: 10 }, speed: 1.5 });
    item.render.media.rotation = 20;
    state.get().projects[0].items = [item];
    const pending = deferred();
    vi.mocked(importMedia).mockImplementation(async () => {
      await pending.promise;
      return imported('new.mp4');
    });
    const operation = state.actions.relinkItem(item.id, 'new.mp4');
    const firstProject = state.get().projects[0];
    const secondProject = createProject(firstProject.profileId);
    item.render.media.rotation = 44;
    state.set({
      ...state.get(),
      projects: [firstProject, secondProject],
      activeProjectByProfile: { [firstProject.profileId]: secondProject.id },
    });
    pending.finish();
    await operation;
    expect(state.get().projects[0].items[0]).toMatchObject({
      id: item.id,
      title: 'new.mp4',
      thumbnailUrl: 'thumbnail:new.mp4',
      status: 'ready',
      speed: 1.5,
      trim: { in: 0, out: 3 },
      render: { media: { rotation: 44, source: 'new.mp4', width: 100, height: 200 } },
    });
    expect(state.get().projects[1].items).toEqual([]);
  });

  it('recusa imagem no lugar de vídeo antes de importar ou persistir qualquer asset', async () => {
    const state = setup();
    const item = imported('old.mp4').item;
    state.get().projects[0].items = [item];
    await expect(state.actions.relinkItem(item.id, 'image.jpg')).rejects.toThrow('mesmo tipo');
    expect(importMedia).not.toHaveBeenCalled();
    expect(state.get().projects[0].items[0]).toBe(item);
  });

  it('não reassocia mídia removida enquanto a nova fonte era analisada', async () => {
    const state = setup();
    const item = imported('old.mp4').item;
    state.get().projects[0].items = [item];
    const pending = deferred();
    vi.mocked(importMedia).mockImplementation(async () => {
      await pending.promise;
      return imported('new.mp4');
    });
    const operation = state.actions.relinkItem(item.id, 'new.mp4');
    state.get().projects[0].items = [];
    pending.finish();
    await expect(operation).rejects.toThrow('mídia foi removida');
    expect(state.get().projects[0].items).toEqual([]);
  });
});
