import { createProfile, createProject, uid } from '../domain/defaults';
import type { AccountTemplate, MediaItem, MigrationReport, Workspace } from '../domain/models';
import { legacyRenderSpec } from '../render/legacy';
import type { VideoItem } from '../types';
import { dataUrlBytes, saveAsset } from './assets';
import { readLegacyFile } from './browserStore';
import { normalizeLegacyItem, normalizeLegacyTemplate, number, object, string } from './legacyNormalize';
import { writeJson } from './storage';

export const LEGACY_KEYS = ['oe_videos', 'oe_images', 'oe_templates', 'oe_groups'] as const;
export type LegacyKey = (typeof LEGACY_KEYS)[number];
export interface LegacySnapshot {
  capturedAt: string;
  keys: Record<LegacyKey, string | null>;
}
export function captureLegacySnapshot(storage: Pick<Storage, 'getItem'>): LegacySnapshot {
  const keys = Object.fromEntries(LEGACY_KEYS.map((key) => [key, storage.getItem(key)])) as LegacySnapshot['keys'];
  return { capturedAt: new Date().toISOString(), keys };
}
export function parseLegacySnapshot(snapshot: LegacySnapshot): Record<LegacyKey, unknown[]> {
  return Object.fromEntries(
    LEGACY_KEYS.map((key) => {
      const source = snapshot.keys[key];
      if (source === null) return [key, []];
      let value: unknown;
      try {
        value = JSON.parse(source);
      } catch {
        throw new Error(`Migração interrompida: ${key} contém JSON inválido. O dado original e seu backup foram preservados.`);
      }
      if (!Array.isArray(value))
        throw new Error(`Migração interrompida: ${key} deveria conter uma lista. Restaure o backup antes de continuar.`);
      return [key, value];
    }),
  ) as Record<LegacyKey, unknown[]>;
}
export function convertLegacySnapshot(snapshot: LegacySnapshot): Workspace {
  const data = parseLegacySnapshot(snapshot);
  const profile = createProfile('Padrão');
  const project = createProject(profile.id, 'Projeto migrado');
  const warnings: string[] = [];
  const groups = new Map<string, string>();
  const templates = new Map<string, string>();
  profile.groups = data.oe_groups.map((raw, index) => {
    const value = object(raw),
      id = uid(),
      oldId = string(value.id, `legacy-group-${index}`);
    if (groups.has(oldId)) warnings.push(`Grupo com ID antigo duplicado: ${oldId}. Todos os grupos foram preservados.`);
    else groups.set(oldId, id);
    return { id, name: string(value.name, 'Grupo recuperado'), type: value.type === 'image' ? 'image' : 'video', legacyPayload: raw };
  });
  const oldTemplates = data.oe_templates.map(normalizeLegacyTemplate);
  profile.templates = oldTemplates.map((old, index): AccountTemplate => {
    const id = uid();
    if (templates.has(old.id)) warnings.push(`Template com ID antigo duplicado: ${old.id}. Todos os templates foram preservados.`);
    else templates.set(old.id, id);
    let groupId = groups.get(old.groupId);
    if (!groupId) {
      groupId = uid();
      groups.set(old.groupId, groupId);
      profile.groups.push({ id: groupId, name: old.type === 'image' ? 'Imagens recuperadas' : 'Vídeos recuperados', type: old.type });
    }
    return {
      id,
      name: old.name,
      groupId,
      category: old.category,
      type: old.type,
      mediaType: old.templateMediaType ?? 'image',
      source: old.dataUrl,
      placement: { x: 0, y: 0, width: 1, rotation: 0, opacity: 1, zIndex: old.category === 'background' ? 5 : 20 },
      headlineText: old.headlineText,
      headlineFontFamily: old.headlineFontFamily,
      headlineFontSize: old.headlineFontSize,
      headlineColor: old.headlineColor,
      headlineAlign: old.headlineAlign,
      legacyPayload: data.oe_templates[index],
    };
  });
  for (const kind of ['video', 'image'] as const) {
    const entries = kind === 'video' ? data.oe_videos : data.oe_images;
    entries.forEach((raw, index) => {
      const old = normalizeLegacyItem(raw, index, kind);
      const value = object(raw);
      const render = legacyRenderSpec(old, oldTemplates);
      render.media.type = kind;
      const references = { ...old.templates };
      for (const key of ['border', 'watermark', 'headline', 'background'] as const) {
        const oldId = references[key];
        references[key] = oldId ? (templates.get(oldId) ?? null) : null;
        if (oldId && !references[key])
          warnings.push(`${old.title}: referência ao template ausente ${oldId}; o ID original foi preservado no backup.`);
      }
      const hadMedia = Boolean(
        old.url ||
        value.sourcePath ||
        (value.fileObj && Object.keys(object(value.fileObj)).length) ||
        value.status === 'ready' ||
        value.status === 'done',
      );
      const item: MediaItem = {
        id: uid(),
        slot: number(value.id, index + 1),
        kind,
        title: old.title,
        sourcePath: string(value.sourcePath) || null,
        status: hadMedia ? 'missing' : 'empty',
        render,
        speed: 1,
        trim: { in: kind === 'video' ? (old as VideoItem).trimIn : 0, out: kind === 'video' ? (old as VideoItem).trimOut : 0 },
        headlineText: old.headlineTextOverride,
        templates: references,
        legacyPayload: raw,
      };
      if (hadMedia) item.error = 'Arquivo antigo ainda não recuperado. Re-vincule se necessário.';
      project.items.push(item);
    });
  }
  const report: MigrationReport = {
    version: 1,
    migratedAt: snapshot.capturedAt,
    backupPath: 'migration/legacy-v1.json',
    counts: {
      videos: data.oe_videos.length,
      images: data.oe_images.length,
      templates: data.oe_templates.length,
      groups: data.oe_groups.length,
      recoveredFiles: 0,
    },
    warnings,
    complete: false,
  };
  return {
    schemaVersion: 2,
    profiles: [profile],
    projects: [project],
    activeProfileId: profile.id,
    activeProjectByProfile: { [profile.id]: project.id },
    migration: report,
  };
}

/** Writes the exact old strings first. Never removes or changes oe_* or the legacy DB. */
export async function migrateLegacy(snapshot: LegacySnapshot): Promise<Workspace> {
  await writeJson('migration/legacy-v1.json', snapshot);
  const workspace = convertLegacySnapshot(snapshot);
  const profile = workspace.profiles[0];
  const report = workspace.migration!;
  const remapSources = new Map<string, string>();
  for (const template of profile.templates) {
    if (!template.source.startsWith('data:')) {
      report.warnings.push(`${template.name}: asset inválido; conteúdo original preservado no backup.`);
      continue;
    }
    try {
      const original = template.source;
      const { bytes, mimeType } = await dataUrlBytes(original);
      const asset = await saveAsset(profile.id, bytes, template.name, mimeType.startsWith('video/') ? 'video' : 'image', mimeType);
      profile.assets.push(asset);
      template.assetId = asset.id;
      template.source = `asset:${asset.id}`;
      remapSources.set(original, template.source);
    } catch (error) {
      report.warnings.push(`${template.name}: ${String(error)}`);
    }
  }
  for (const item of workspace.projects[0].items) {
    if ('source' in item.render.background)
      item.render.background.source = remapSources.get(item.render.background.source) ?? item.render.background.source;
    item.render.layers = item.render.layers.map((layer) =>
      'source' in layer ? { ...layer, source: remapSources.get(layer.source) ?? layer.source } : layer,
    );
    try {
      const oldId = object(item.legacyPayload).id ?? item.slot;
      const file = await readLegacyFile(item.kind, typeof oldId === 'number' ? oldId : string(oldId, String(item.slot)));
      if (!file) {
        if (item.status === 'missing') report.warnings.push(`${item.title}: arquivo ausente no banco antigo; use Re-vincular.`);
        continue;
      }
      const asset = await saveAsset(profile.id, new Uint8Array(await file.arrayBuffer()), item.title, item.kind, file.type);
      profile.assets.push(asset);
      item.assetId = asset.id;
      item.render.media.source = `asset:${asset.id}`;
      item.status = 'ready';
      item.error = undefined;
      report.counts.recoveredFiles++;
    } catch (error) {
      report.warnings.push(`${item.title}: recuperação interrompida: ${String(error)}`);
    }
  }
  report.complete = report.warnings.length === 0;
  return workspace;
}
