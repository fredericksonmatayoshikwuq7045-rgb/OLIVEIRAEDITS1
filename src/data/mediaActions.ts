import { invoke } from '@tauri-apps/api/core';
import { isoNow, uid } from '../domain/defaults';
import type { AccountTemplate, MediaItem, MediaKind, MediaProbe, Profile, TemplateCategory, Workspace } from '../domain/models';
import { saveAsset } from './assets';
import { baseName, importMedia, mediaKind, probeBrowser } from './mediaImport';
import { placeImportedMedia, relinkMedia } from './mediaPlacement';
import { withRetainedAssets } from './retainedAssets';
import { authorizePaths, isNative } from './storage';
import type { WorkspaceContext } from './workspaceActions';

export interface ImportProgress {
  completed: number;
  total: number;
}
export interface ImportReport {
  imported: number;
  failed: number;
  ignored: number;
}

export function mediaActions(context: WorkspaceContext) {
  const currentProfile = (): Profile => {
    const workspace = context.get();
    const profile = workspace?.profiles.find((profile) => profile.id === workspace.activeProfileId);
    if (!profile) throw new Error('Abra uma conta antes de importar arquivos.');
    return profile;
  };
  const currentProject = (profileId: string) => {
    const workspace = context.get();
    const project = workspace?.projects.find((value) => value.id === workspace.activeProjectByProfile[profileId]);
    if (!project || project.profileId !== profileId) throw new Error('Abra um projeto antes de importar arquivos.');
    return project;
  };
  const mutateProject = (workspace: Workspace, projectId: string, fn: (items: MediaItem[]) => MediaItem[]) => {
    if (!workspace.projects.some((project) => project.id === projectId)) {
      throw new Error('O projeto de destino foi removido durante a importação. Abra um projeto e importe novamente.');
    }
    return workspace.projects.map((project) =>
      project.id === projectId ? { ...project, items: fn(project.items), updatedAt: isoNow() } : project,
    );
  };
  return {
    importFiles: (files: File[] | string[], onProgress?: (progress: ImportProgress) => void): Promise<ImportReport> =>
      withRetainedAssets(context, async () => {
        const profile = currentProfile();
        const projectId = currentProject(profile.id).id;
        const compatible = files.filter((file) => mediaKind(typeof file === 'string' ? file : file.name));
        const ignored = files.length - compatible.length;
        const warnings: string[] = [];
        if (ignored) warnings.push(`${ignored} arquivo(s) ignorado(s) por formato incompatível.`);
        const items: MediaItem[] = [],
          assets = [] as Profile['assets'];
        const sorted = [...compatible].sort((a, b) =>
          (typeof a === 'string' ? a : a.name).localeCompare(typeof b === 'string' ? b : b.name, 'pt-BR', {
            numeric: true,
            sensitivity: 'base',
          }),
        );
        let completed = 0;
        onProgress?.({ completed, total: compatible.length });
        for (const input of sorted) {
          try {
            const result = await importMedia(input, profile, 0, context.manager());
            items.push(result.item);
            if (result.asset) assets.push(result.asset);
          } catch (error) {
            warnings.push(`${typeof input === 'string' ? baseName(input) : input.name}: ${String(error)}`);
          }
          onProgress?.({ completed: ++completed, total: compatible.length });
        }
        if (items.length)
          context.update((workspace) => ({
            ...workspace,
            profiles: workspace.profiles.map((value) =>
              value.id === profile.id ? { ...value, assets: [...value.assets, ...assets] } : value,
            ),
            projects: mutateProject(workspace, projectId, (previous) => placeImportedMedia(previous, items)),
          }));
        context.warn(warnings);
        return { imported: items.length, failed: compatible.length - items.length, ignored };
      }),
    relinkItem: (itemId: string, input: File | string): Promise<void> =>
      withRetainedAssets(context, async () => {
        const profile = currentProfile();
        const project = currentProject(profile.id);
        const original = project.items.find((item) => item.id === itemId);
        if (!original) throw new Error('A mídia a ser vinculada não existe mais neste projeto.');
        if (mediaKind(typeof input === 'string' ? input : input.name) !== original.kind) {
          throw new Error('Selecione uma mídia do mesmo tipo do item original.');
        }
        const result = await importMedia(input, profile, 0, context.manager());
        context.update((workspace) => ({
          ...workspace,
          profiles: workspace.profiles.map((value) =>
            value.id === profile.id && result.asset ? { ...value, assets: [...value.assets, result.asset] } : value,
          ),
          projects: mutateProject(workspace, project.id, (items) => {
            if (!items.some((item) => item.id === itemId)) throw new Error('A mídia foi removida durante a vinculação.');
            return items.map((item) => (item.id === itemId ? relinkMedia(item, result.item) : item));
          }),
        }));
      }),
    addTemplate: (input: File | string, category: TemplateCategory, name?: string, targetKind: MediaKind = 'video'): Promise<string> =>
      withRetainedAssets(context, async () => {
        const profile = currentProfile();
        if (typeof input === 'string') await authorizePaths([input]);
        const filename = typeof input === 'string' ? baseName(input) : input.name;
        const kind = mediaKind(filename) === 'video' ? 'video' : 'image';
        const asset = await saveAsset(profile.id, input, filename, kind, typeof input === 'string' ? undefined : input.type);
        const runtimeUrl = await context.manager().resolve(asset);
        const probe =
          typeof input === 'string' && isNative()
            ? await invoke<MediaProbe>('probe_media', { path: input })
            : await probeBrowser(runtimeUrl, kind, filename, typeof input === 'string' ? 0 : input.size);
        const group = profile.groups.find((group) => group.type === targetKind) ?? {
          id: uid(),
          name: targetKind === 'video' ? 'Vídeos' : 'Imagens',
          type: targetKind,
        };
        const template: AccountTemplate = {
          id: uid(),
          name: name?.trim() || filename,
          groupId: group.id,
          category,
          type: targetKind,
          mediaType: kind,
          sourceWidth: probe.width,
          sourceHeight: probe.height,
          assetId: asset.id,
          source: `asset:${asset.id}`,
          runtimeUrl,
          placement:
            category === 'watermark'
              ? { x: 0.65, y: 0.05, width: 0.28, rotation: 0, opacity: 1, zIndex: 20 }
              : { x: 0, y: 0, width: 1, rotation: 0, opacity: 1, zIndex: category === 'background' ? 5 : 30 },
        };
        context.update((workspace) => ({
          ...workspace,
          profiles: workspace.profiles.map((value) =>
            value.id === profile.id
              ? {
                  ...value,
                  templates: [...value.templates, template],
                  assets: [...value.assets, asset],
                  groups: value.groups.some((value) => value.id === group.id) ? value.groups : [...value.groups, group],
                }
              : value,
          ),
        }));
        return template.id;
      }),
    addFont: (input: File | string): Promise<void> =>
      withRetainedAssets(context, async () => {
        const profile = currentProfile();
        const name = typeof input === 'string' ? baseName(input) : input.name;
        if (!/\.(ttf|otf|woff2?)$/i.test(name)) throw new Error('Selecione uma fonte TTF, OTF, WOFF ou WOFF2.');
        if (typeof input === 'string') await authorizePaths([input]);
        const asset = await saveAsset(profile.id, input, name, 'font');
        const id = uid();
        const font = { id, name, family: `oe_font_${id}`, assetId: asset.id };
        const updated = { ...profile, assets: [...profile.assets, asset], fonts: [...profile.fonts, font] };
        await context.manager().loadFonts(updated);
        context.update((workspace) => ({
          ...workspace,
          profiles: workspace.profiles.map((value) =>
            value.id === profile.id ? { ...value, assets: [...value.assets, asset], fonts: [...value.fonts, font] } : value,
          ),
        }));
      }),
  };
}
