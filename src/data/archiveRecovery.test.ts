import { beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { createMediaItem, createWorkspace } from '../domain/defaults';
import type { AssetRef } from '../domain/models';
import { AssetManager } from './assets';
import { importProfileArchive } from './profileArchive';
import { readBytes, writeBytes } from './storage';
import { dehydrateWorkspace, hydrateWorkspace } from './workspaceIO';

vi.mock('./storage', () => ({
  isNative: () => false,
  readBytes: vi.fn(),
  writeBytes: vi.fn(),
}));
const asset: AssetRef = {
  id: 'asset-original',
  relativePath: 'profiles/account/assets/asset-original.png',
  source: 'asset-original.png',
  name: 'original.png',
  mimeType: 'image/png',
  kind: 'image',
};
function manifest() {
  const workspace = createWorkspace();
  return { format: 'oeprofile', version: 2, profile: workspace.profiles[0], projects: workspace.projects };
}
function archive(value: unknown, assets: Record<string, Uint8Array> = {}) {
  return zipSync({ 'profile.json': strToU8(JSON.stringify(value)), ...assets });
}
beforeEach(() => {
  vi.clearAllMocks();
});

describe('recuperação de fontes de assets', () => {
  it('preserva IDs de fundos/camadas ausentes ao salvar e volta a resolvê-los após restaurar o asset', async () => {
    const workspace = createWorkspace();
    workspace.profiles[0].assets.push(asset);
    const item = createMediaItem('image', 1);
    item.status = 'ready';
    item.assetId = asset.id;
    item.probe = {
      path: asset.name,
      width: 20,
      height: 20,
      duration: 0,
      fps: 0,
      codec: 'png',
      pixFmt: 'rgba',
      rotation: 0,
      hasAudio: false,
      sizeBytes: 4,
      isImage: true,
      tags: {},
    };
    item.render.background = { type: 'image', source: `asset:${asset.id}`, width: 20, height: 20, opacity: 1, loop: true, audio: 'mute' };
    item.render.layers.push({
      id: 'layer-original',
      type: 'image',
      source: `asset:${asset.id}`,
      sourceWidth: 20,
      sourceHeight: 20,
      fit: 'contain',
      rect: { x: 0, y: 0, width: 1, height: 1 },
      rotation: 0,
      opacity: 1,
      zIndex: 20,
      visible: true,
    });
    workspace.projects[0].items.push(item);
    vi.mocked(readBytes).mockRejectedValue(new Error('Asset ausente'));
    const manager = new AssetManager();
    const missing = await hydrateWorkspace(workspace, manager);
    expect(missing.warnings).toContain('Error: Asset ausente');
    const stable = dehydrateWorkspace(missing.workspace, manager);
    expect(stable.projects[0].items[0].render.background).toMatchObject({ source: `asset:${asset.id}` });
    expect(stable.projects[0].items[0].render.layers[0]).toMatchObject({ source: `asset:${asset.id}` });
    manager.dispose();

    vi.mocked(readBytes).mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    const restoredManager = new AssetManager();
    try {
      const restored = await hydrateWorkspace(stable, restoredManager);
      const restoredItem = restored.workspace.projects[0].items[0];
      expect(restoredItem.status).toBe('ready');
      expect(restoredItem.render.background).toMatchObject({ source: restoredItem.runtimeUrl });
      expect(restoredItem.render.layers[0]).toMatchObject({ source: restoredItem.runtimeUrl });
      expect(dehydrateWorkspace(restored.workspace, restoredManager).projects[0].items[0].render.layers[0]).toMatchObject({
        source: `asset:${asset.id}`,
      });
    } finally {
      restoredManager.dispose();
    }
  });
});

describe('validação de backup antes de gravar assets', () => {
  it('recusa o manifesto mínimo que antes causava falha de autosave após a importação', async () => {
    const invalid = {
      format: 'oeprofile',
      version: 2,
      profile: { id: 'bad', name: 'Bad', assets: [], templates: [], groups: [] },
      projects: [],
    };
    await expect(importProfileArchive(archive(invalid))).rejects.toThrow('Nenhuma conta foi importada');
    expect(writeBytes).not.toHaveBeenCalled();
  });
  it.each(['fonts', 'framingPresets', 'textStyles', 'exportSettings', 'aspectRatio', 'mixRules'] as const)(
    'recusa %s ausente antes de escrever um asset válido',
    async (field) => {
      const value = manifest();
      value.profile.assets.push(asset);
      const profile = value.profile as unknown as Record<string, unknown>;
      delete profile[field];
      await expect(importProfileArchive(archive(value, { 'assets/asset-original.png': new Uint8Array([1, 2, 3]) }))).rejects.toThrow(
        `profile.${field}`,
      );
      expect(writeBytes).not.toHaveBeenCalled();
    },
  );
  it('recusa um projeto de outra conta antes de gravar assets', async () => {
    const foreign = manifest();
    foreign.projects[0].profileId = 'outra-conta';
    await expect(importProfileArchive(archive(foreign))).rejects.toThrow('profileId');
    expect(writeBytes).not.toHaveBeenCalled();
  });
  it('recusa IDs duplicados e modelos de renderização incompletos', async () => {
    const duplicates = manifest();
    duplicates.profile.groups.push({ id: duplicates.profile.id, name: 'Grupo', type: 'image' });
    await expect(importProfileArchive(archive(duplicates))).rejects.toThrow('IDs duplicados');
    const incomplete = manifest();
    const item = createMediaItem('image', 1);
    delete (item.render.media as unknown as Record<string, unknown>).crop;
    incomplete.projects[0].items.push(item);
    await expect(importProfileArchive(archive(incomplete))).rejects.toThrow('render.media.crop');
    expect(writeBytes).not.toHaveBeenCalled();
  });
  it('importa um manifesto completo preservando conteúdo e remapeando a propriedade dos projetos', async () => {
    const value = manifest();
    value.profile.name = 'Conta íntegra';
    const item = createMediaItem('image', 1);
    value.projects[0].items.push(item);
    const imported = await importProfileArchive(archive(value));
    expect(imported.profile.name).toBe('Conta íntegra');
    expect(imported.profile.id).not.toBe(value.profile.id);
    expect(imported.projects[0].profileId).toBe(imported.profile.id);
    expect(imported.projects[0].items[0].id).not.toBe(item.id);
    expect(() =>
      dehydrateWorkspace(
        {
          schemaVersion: 2,
          profiles: [imported.profile],
          projects: imported.projects,
          activeProfileId: imported.profile.id,
          activeProjectByProfile: {},
        },
        new AssetManager(),
      ),
    ).not.toThrow();
  });
  it('preserva referências históricas removidas e avisa sobre assets ausentes ao hidratar', async () => {
    const value = manifest();
    const item = createMediaItem('image', 1);
    item.templates.watermark = 'template-removido';
    item.assetId = 'asset-removido';
    value.projects[0].items.push(item);
    value.profile.mixRules.watermark = { mode: 'fixed', seed: 1, templateIds: ['template-removido'] };
    value.profile.fonts.push({ id: 'font', name: 'Fonte', family: 'Family', assetId: 'asset-fonte-removido' });
    value.profile.templates.push({
      id: 'template',
      name: 'Marca',
      groupId: 'grupo-removido',
      assetId: 'asset-removido',
      category: 'watermark',
      type: 'image',
      source: 'asset:asset-removido',
      placement: { x: 0, y: 0, width: 1, rotation: 0, opacity: 1, zIndex: 20 },
    });
    const imported = await importProfileArchive(archive(value));
    expect(imported.projects[0].items[0].templates.watermark).toBe('template-removido');
    expect(imported.projects[0].items[0].assetId).toBe('asset-removido');
    expect(imported.profile.mixRules.watermark?.templateIds).toEqual(['template-removido']);
    expect(imported.profile.templates[0].groupId).toBe('grupo-removido');
    expect(imported.profile.fonts[0].assetId).toBe('asset-fonte-removido');
    const manager = new AssetManager();
    try {
      const hydrated = await hydrateWorkspace(
        {
          schemaVersion: 2,
          profiles: [imported.profile],
          projects: imported.projects,
          activeProfileId: imported.profile.id,
          activeProjectByProfile: {},
        },
        manager,
      );
      expect(hydrated.warnings.join(' ')).toContain('asset-removido');
      expect(hydrated.workspace.profiles[0].templates[0].source).toBe('asset:asset-removido');
    } finally {
      manager.dispose();
    }
  });
});
