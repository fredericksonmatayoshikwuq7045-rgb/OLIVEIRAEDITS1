import { invoke } from '@tauri-apps/api/core';
import { isoNow, uid } from '../domain/defaults';
import type { AccountTemplate, MediaItem, MediaKind, MediaProbe, Profile, TemplateCategory, Workspace } from '../domain/models';
import { saveAsset } from './assets';
import { baseName, importMedia, mediaKind, probeBrowser } from './mediaImport';
import { authorizePaths, isNative } from './storage';
import type { WorkspaceContext } from './workspaceActions';

export function mediaActions(context: WorkspaceContext) {
  const currentProfile = (): Profile => {
    const workspace = context.get();
    const profile = workspace?.profiles.find((profile) => profile.id === workspace.activeProfileId);
    if (!profile) throw new Error('Abra uma conta antes de importar arquivos.');
    return profile;
  };
  const mutateProject = (workspace: Workspace, profileId: string, fn: (items: MediaItem[]) => MediaItem[]) => {
    const projectId = workspace.activeProjectByProfile[profileId];
    return workspace.projects.map((project) =>
      project.id === projectId ? { ...project, items: fn(project.items), updatedAt: isoNow() } : project,
    );
  };
  return {
    importFiles: async (files: File[] | string[]): Promise<void> => {
      const profile = currentProfile();
      const compatible = files.filter((file) => mediaKind(typeof file === 'string' ? file : file.name));
      const warnings: string[] = [];
      if (compatible.length < files.length)
        warnings.push(`${files.length - compatible.length} arquivo(s) ignorado(s) por formato incompatível.`);
      const project = context.get()?.projects.find((project) => project.id === context.get()?.activeProjectByProfile[profile.id]);
      let slot = Math.max(0, ...(project?.items.map((item) => item.slot) ?? []));
      const items: MediaItem[] = [],
        assets = [] as Profile['assets'];
      const sorted = [...compatible].sort((a, b) =>
        (typeof a === 'string' ? a : a.name).localeCompare(typeof b === 'string' ? b : b.name, 'pt-BR', {
          numeric: true,
          sensitivity: 'base',
        }),
      );
      for (const input of sorted) {
        try {
          const result = await importMedia(input, profile, ++slot, context.manager());
          items.push(result.item);
          if (result.asset) assets.push(result.asset);
        } catch (error) {
          warnings.push(`${typeof input === 'string' ? baseName(input) : input.name}: ${String(error)}`);
        }
      }
      if (items.length)
        context.update((workspace) => ({
          ...workspace,
          profiles: workspace.profiles.map((value) =>
            value.id === profile.id ? { ...value, assets: [...value.assets, ...assets] } : value,
          ),
          projects: mutateProject(workspace, profile.id, (previous) => [...previous, ...items]),
        }));
      context.warn(warnings);
    },
    relinkItem: async (itemId: string, input: File | string): Promise<void> => {
      const profile = currentProfile();
      const result = await importMedia(input, profile, 0, context.manager());
      context.update((workspace) => ({
        ...workspace,
        profiles: workspace.profiles.map((value) =>
          value.id === profile.id && result.asset ? { ...value, assets: [...value.assets, result.asset] } : value,
        ),
        projects: mutateProject(workspace, profile.id, (items) =>
          items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  sourcePath: result.item.sourcePath,
                  assetId: result.item.assetId,
                  runtimeUrl: result.item.runtimeUrl,
                  probe: result.item.probe,
                  status: 'ready',
                  error: undefined,
                  render: {
                    ...item.render,
                    media: {
                      ...item.render.media,
                      source: result.item.render.media.source,
                      width: result.item.render.media.width,
                      height: result.item.render.media.height,
                    },
                  },
                  trim: {
                    in: Math.min(item.trim.in, Math.max(0, (result.item.probe?.duration ?? 0) - 0.001)),
                    out: item.trim.out > 0 ? Math.min(item.trim.out, result.item.probe?.duration ?? 0) : (result.item.probe?.duration ?? 0),
                  },
                }
              : item,
          ),
        ),
      }));
    },
    addTemplate: async (
      input: File | string,
      category: TemplateCategory,
      name?: string,
      targetKind: MediaKind = 'video',
    ): Promise<void> => {
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
    },
    addFont: async (input: File | string): Promise<void> => {
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
    },
  };
}
