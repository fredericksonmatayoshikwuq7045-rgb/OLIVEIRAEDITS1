import { invoke } from '@tauri-apps/api/core';
import { nativeMediaUrl } from './nativeMedia';
import type { MediaProbe, Workspace } from '../domain/models';
import type { AssetManager } from './assets';
import { probeBrowser } from './mediaImport';
import { isNative, pathExists, readJson, writeJson } from './storage';
import { generateThumbnail } from './thumbnails';

interface WorkspaceIndex extends Omit<Workspace, 'profiles' | 'projects'> {
  profileIds: string[];
  projectIds: string[];
}
function validateWorkspace(value: Workspace): Workspace {
  if (value.schemaVersion !== 2 || !Array.isArray(value.profiles) || !Array.isArray(value.projects)) {
    throw new Error('Formato de dados não reconhecido. Os arquivos foram preservados; restaure um backup compatível.');
  }
  return value;
}
export async function loadWorkspace(): Promise<Workspace | null> {
  if (!isNative()) {
    const value = await readJson<Workspace>('workspace.json');
    return value ? validateWorkspace(value) : null;
  }
  const index = await readJson<WorkspaceIndex>('settings.json');
  if (!index) return null;
  if (index.schemaVersion !== 2 || !Array.isArray(index.profileIds) || !Array.isArray(index.projectIds)) {
    throw new Error('settings.json incompatível. Preserve os arquivos antes de restaurar um backup.');
  }
  const profiles = await Promise.all(index.profileIds.map((id) => readJson<Workspace['profiles'][number]>(`profiles/${id}/profile.json`)));
  const projects = await Promise.all(index.projectIds.map((id) => readJson<Workspace['projects'][number]>(`projects/${id}.json`)));
  if (profiles.some((value) => !value) || projects.some((value) => !value)) {
    throw new Error(
      'Há perfis ou projetos ausentes no armazenamento. Nenhum dado foi sobrescrito; restaure os arquivos indicados em settings.json.',
    );
  }
  return validateWorkspace({
    ...index,
    profiles: profiles.filter((value) => value !== null),
    projects: projects.filter((value) => value !== null),
  });
}
export function dehydrateWorkspace(workspace: Workspace, assets: AssetManager): Workspace {
  const stableRender = (render: Workspace['projects'][number]['items'][number]['render']) => ({
    ...render,
    media: { ...render.media, source: assets.stable(render.media.source) },
    background:
      'source' in render.background ? { ...render.background, source: assets.stable(render.background.source) } : render.background,
    layers: render.layers.map((layer) => ('source' in layer ? { ...layer, source: assets.stable(layer.source) } : layer)),
  });
  return {
    ...workspace,
    profiles: workspace.profiles.map((profile) => ({
      ...profile,
      framingPresets: profile.framingPresets.map((preset) => ({ ...preset, media: { ...preset.media, source: '' } })),
      assets: profile.assets.map(({ runtimeUrl: _url, ...asset }) => asset),
      templates: profile.templates.map(({ runtimeUrl: _url, ...template }) => ({ ...template, source: assets.stable(template.source) })),
    })),
    projects: workspace.projects.map((project) => ({
      ...project,
      items: project.items.map((item) => {
        const { runtimeUrl: _url, thumbnailUrl, ...record } = item;
        const render = stableRender(record.render);
        render.media.source = item.assetId ? `asset:${item.assetId}` : (item.sourcePath ?? render.media.source);
        return { ...record, ...(thumbnailUrl?.startsWith('data:image/') ? { thumbnailUrl } : {}), render };
      }),
    })),
  };
}
export async function persistWorkspace(workspace: Workspace, assets: AssetManager): Promise<void> {
  const stable = dehydrateWorkspace(workspace, assets);
  if (!isNative()) {
    await writeJson('workspace.json', stable);
    return;
  }
  for (const profile of stable.profiles) await writeJson(`profiles/${profile.id}/profile.json`, profile);
  for (const project of stable.projects) await writeJson(`projects/${project.id}.json`, project);
  const { profiles, projects, ...settings } = stable;
  // Publish the index last; a failed new-profile write cannot reference partial data.
  await writeJson('settings.json', {
    ...settings,
    profileIds: profiles.map((value) => value.id),
    projectIds: projects.map((value) => value.id),
  });
}
export async function hydrateWorkspace(workspace: Workspace, manager: AssetManager): Promise<{ workspace: Workspace; warnings: string[] }> {
  const result = structuredClone(workspace);
  const warnings: string[] = [];
  for (const profile of result.profiles) {
    const urls = new Map<string, string>();
    for (const asset of profile.assets) {
      try {
        asset.runtimeUrl = await manager.resolve(asset);
        urls.set(asset.id, asset.runtimeUrl);
      } catch (error) {
        warnings.push(String(error));
      }
    }
    const resolve = (source: string) => {
      if (!source.startsWith('asset:')) return source;
      const url = urls.get(source.slice(6));
      if (!url) warnings.push(`${profile.name}: asset ${source.slice(6)} ausente. A referência foi preservada para recuperação.`);
      return url ?? source;
    };
    for (const template of profile.templates) {
      if (template.assetId) {
        template.runtimeUrl = urls.get(template.assetId);
        if (!template.runtimeUrl) warnings.push(`${template.name}: asset ${template.assetId} ausente. Restaure o backup do asset.`);
      } else template.runtimeUrl = resolve(template.source);
    }
    for (const project of result.projects.filter((project) => project.profileId === profile.id)) {
      for (const item of project.items) {
        if (item.status === 'empty') continue;
        // Native cache URLs can outlive the cache. Only embedded browser previews survive a reload.
        if (!item.thumbnailUrl?.startsWith('data:image/')) item.thumbnailUrl = undefined;
        if (item.assetId) item.runtimeUrl = urls.get(item.assetId);
        else if (item.sourcePath && isNative()) {
          try {
            if (await pathExists(item.sourcePath)) item.runtimeUrl = await nativeMediaUrl(item.sourcePath, item.kind);
          } catch (error) {
            warnings.push(`${item.title}: ${String(error)}`);
          }
        }
        if (!item.runtimeUrl) {
          item.status = 'missing';
          item.error = 'Arquivo ausente. Use Re-vincular para localizar a mídia original.';
        } else {
          item.status = 'ready';
          item.error = undefined;
          if (!item.probe || item.probe.width <= 0 || item.probe.height <= 0) {
            try {
              const asset = profile.assets.find((asset) => asset.id === item.assetId);
              item.probe = isNative()
                ? await invoke<MediaProbe>('probe_media', { path: item.sourcePath ?? asset?.source })
                : await probeBrowser(item.runtimeUrl, item.kind, item.title, 0);
              item.render.media.width = item.probe.width;
              item.render.media.height = item.probe.height;
              if (item.kind === 'video' && item.trim.out <= 0) item.trim.out = item.probe.duration;
            } catch (error) {
              item.status = 'error';
              item.error = `Não foi possível ler a mídia: ${String(error)}`;
              warnings.push(`${item.title}: ${item.error}`);
            }
          }
        }
        item.render.media.source = item.runtimeUrl ?? '';
        if (item.kind === 'video' && item.status === 'ready' && (isNative() || !item.thumbnailUrl)) {
          try {
            item.thumbnailUrl = await generateThumbnail(
              item,
              item.sourcePath ?? profile.assets.find((asset) => asset.id === item.assetId)?.source,
            );
          } catch (error) {
            item.thumbnailUrl = undefined;
            console.warn('Miniatura indisponível:', error);
          }
        }
        if ('source' in item.render.background) item.render.background.source = resolve(item.render.background.source);
        item.render.layers = item.render.layers.map((layer) => ('source' in layer ? { ...layer, source: resolve(layer.source) } : layer));
      }
    }
    try {
      await manager.loadFonts(profile);
    } catch (error) {
      warnings.push(String(error));
    }
  }
  if (result.migration && warnings.length) {
    result.migration.warnings = [...new Set([...result.migration.warnings, ...warnings])];
    result.migration.complete = false;
  }
  return { workspace: result, warnings };
}
