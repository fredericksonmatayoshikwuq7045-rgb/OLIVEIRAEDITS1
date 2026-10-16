import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { isoNow, uid } from '../domain/defaults';
import type { AssetRef, Profile, Project, Workspace } from '../domain/models';
import { assetExtension, AssetManager } from './assets';
import { validateManifest, type ProfileArchive } from './archiveValidation';
import { readBytes, writeBytes } from './storage';
import { dehydrateWorkspace } from './workspaceIO';

const MAX_ARCHIVE_SIZE = 512 * 1024 * 1024;
const MAX_ENTRY_SIZE = 256 * 1024 * 1024;
const MAX_ENTRIES = 5000;
function validEntry(path: string): boolean {
  return (
    !!path &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.includes(':') &&
    path.split('/').every((part) => part !== '..' && part !== '.' && part !== '')
  );
}
/** Inspect ZIP directory before decompression to limit archive bombs. */
export function inspectArchive(bytes: Uint8Array): void {
  if (!bytes.length || bytes.length > MAX_ARCHIVE_SIZE) throw new Error('O perfil está vazio ou excede o limite de 512 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let entries = 0,
    total = 0;
  for (let offset = 0; offset + 46 <= bytes.length; offset++) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const flags = view.getUint16(offset + 8, true);
    const compressed = view.getUint32(offset + 20, true),
      expanded = view.getUint32(offset + 24, true);
    const length = view.getUint16(offset + 28, true),
      extra = view.getUint16(offset + 30, true),
      comment = view.getUint16(offset + 32, true);
    if (offset + 46 + length + extra + comment > bytes.length) throw new Error('Diretório ZIP truncado.');
    const path = strFromU8(bytes.subarray(offset + 46, offset + 46 + length));
    if (flags & 1 || !validEntry(path) || expanded > MAX_ENTRY_SIZE || expanded / Math.max(1, compressed) > 1000) {
      throw new Error('Perfil recusado: entrada criptografada, caminho inseguro ou tamanho descompactado excessivo.');
    }
    total += expanded;
    entries++;
    if (entries > MAX_ENTRIES || total > MAX_ARCHIVE_SIZE) throw new Error('O conteúdo do perfil excede o limite de segurança.');
    offset += 45 + length + extra + comment;
  }
  if (!entries) throw new Error('O arquivo não contém um perfil ZIP válido.');
}
export async function exportProfileArchive(workspace: Workspace, profileId: string, manager: AssetManager): Promise<Uint8Array> {
  const stable = dehydrateWorkspace(workspace, manager);
  const profile = stable.profiles.find((profile) => profile.id === profileId);
  if (!profile) throw new Error('Conta não encontrada.');
  const manifest: ProfileArchive = {
    format: 'oeprofile',
    version: 2,
    profile,
    projects: stable.projects.filter((project) => project.profileId === profileId),
  };
  const files: Record<string, Uint8Array> = { 'profile.json': strToU8(JSON.stringify(manifest)) };
  let total = files['profile.json'].length;
  for (const asset of profile.assets) {
    const bytes = await readBytes(asset.relativePath);
    total += bytes.length;
    if (bytes.length > MAX_ENTRY_SIZE || total > MAX_ARCHIVE_SIZE)
      throw new Error('O backup excede 512 MB. Exporte os vídeos originais separadamente.');
    files[`assets/${asset.id}.${assetExtension(asset.name, asset.mimeType)}`] = bytes;
  }
  return zipSync(files, { level: 6 });
}
function replaceReferences<T>(value: T, replacements: Map<string, string>): T {
  if (typeof value === 'string') return (replacements.get(value) ?? value) as T;
  if (Array.isArray(value)) return value.map((entry) => replaceReferences(entry, replacements)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        replacements.get(key) ?? key,
        key === 'legacyPayload' ? entry : replaceReferences(entry, replacements),
      ]),
    ) as T;
  return value;
}
export async function importProfileArchive(bytes: Uint8Array): Promise<{ profile: Profile; projects: Project[] }> {
  inspectArchive(bytes);
  const files = unzipSync(bytes, { filter: (file) => validEntry(file.name) && file.originalSize <= MAX_ENTRY_SIZE });
  if (!files['profile.json']) throw new Error('profile.json ausente no backup.');
  let manifest: unknown;
  try {
    manifest = JSON.parse(strFromU8(files['profile.json'])) as unknown;
  } catch {
    throw new Error(
      'profile.json contém JSON inválido. Nenhuma conta foi importada; gere novamente o .oeprofile ou restaure um backup íntegro.',
    );
  }
  const archive = validateManifest(manifest);
  const replacements = new Map<string, string>();
  const add = (id: string) => {
    if (id && !replacements.has(id)) replacements.set(id, uid());
  };
  add(archive.profile.id);
  for (const collection of [
    archive.profile.assets,
    archive.profile.templates,
    archive.profile.groups,
    archive.profile.fonts ?? [],
    archive.profile.framingPresets ?? [],
    archive.profile.textStyles ?? [],
    archive.projects,
  ]) {
    for (const entry of collection) add(entry.id);
  }
  for (const project of archive.projects) for (const item of project.items) add(item.id);
  for (const font of archive.profile.fonts ?? []) replacements.set(font.family, `oe_font_${replacements.get(font.id)}`);
  for (const asset of archive.profile.assets) replacements.set(`asset:${asset.id}`, `asset:${replacements.get(asset.id)}`);
  const profile = replaceReferences(archive.profile, replacements);
  const projects = replaceReferences(archive.projects, replacements);
  const assets: AssetRef[] = [];
  // Validate every entry before writing any asset; failures leave the current workspace untouched.
  for (const asset of archive.profile.assets) {
    const key = `assets/${asset.id}.${assetExtension(asset.name, asset.mimeType)}`;
    if (!files[key]) throw new Error(`Backup incompleto: ${asset.name} está ausente.`);
  }
  for (const original of archive.profile.assets) {
    const id = replacements.get(original.id)!;
    const extension = assetExtension(original.name, original.mimeType);
    const relativePath = `profiles/${profile.id}/assets/${id}.${extension}`;
    const source = await writeBytes(relativePath, files[`assets/${original.id}.${extension}`]);
    replacements.set(original.source, `asset:${id}`);
    assets.push({ ...original, id, relativePath, source, runtimeUrl: undefined });
  }
  const remapped = replaceReferences({ profile, projects }, replacements);
  remapped.profile.assets = assets;
  remapped.profile.createdAt = isoNow();
  remapped.profile.lastUsedAt = isoNow();
  remapped.profile.archived = false;
  return remapped;
}
