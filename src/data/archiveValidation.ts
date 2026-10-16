import type { Profile, Project } from '../domain/models';
import { media, render } from './archiveRenderValidation';
import {
  aspect,
  boolean,
  choices,
  fields,
  identifier,
  invalid,
  kind,
  list,
  nullable,
  number,
  opacity,
  optional,
  positive,
  record,
  text,
  type Check,
} from './archiveSchema';

export interface ProfileArchive {
  format: 'oeprofile';
  version: 2;
  profile: Profile;
  projects: Project[];
}
const category = choices('border', 'watermark', 'headline', 'background');
const template: Check = fields({
  id: identifier,
  name: text,
  groupId: identifier,
  category,
  type: kind,
  mediaType: optional(kind),
  sourceWidth: optional(positive),
  sourceHeight: optional(positive),
  assetId: optional(identifier),
  source: text,
  placement: fields({ x: number, y: number, width: positive, rotation: number, opacity, zIndex: number }),
  headlineText: optional(text),
  headlineFontFamily: optional(text),
  headlineFontSize: optional(positive),
  headlineColor: optional(text),
  headlineAlign: optional(choices('left', 'center', 'right')),
});
const mix: Check = (value, path) => {
  for (const [key, entry] of Object.entries(record(value, path))) {
    category(key, `${path}.${key}`);
    fields({ mode: choices('fixed', 'sequential', 'random', 'no-repeat'), seed: number, templateIds: list(identifier) })(
      entry,
      `${path}.${key}`,
    );
  }
};
const profile: Check = fields({
  id: identifier,
  name: text,
  handle: text,
  niche: text,
  color: text,
  notes: text,
  avatarAssetId: optional(identifier),
  archived: boolean,
  order: number,
  createdAt: text,
  lastUsedAt: text,
  aspectRatio: aspect,
  assets: list(
    fields({ id: identifier, relativePath: text, name: text, mimeType: text, kind: choices('image', 'video', 'font'), source: text }),
  ),
  templates: list(template),
  groups: list(fields({ id: identifier, name: text, type: kind })),
  fonts: list(fields({ id: identifier, name: text, family: text, assetId: identifier })),
  framingPresets: list(fields({ id: identifier, name: text, media, aspectRatio: aspect })),
  textStyles: list(
    fields({
      id: identifier,
      name: text,
      fontFamily: text,
      fontSize: positive,
      color: text,
      backgroundColor: text,
      strokeColor: optional(text),
      strokeWidth: optional(number),
    }),
  ),
  exportSettings: fields({
    preset: choices('fast', 'standard', 'high', 'nvenc'),
    outputDir: text,
    filenamePattern: text,
    cleanMetadata: boolean,
    imageFormat: choices('png', 'jpeg', 'webp'),
    imageQuality: opacity,
    conflict: choices('suffix', 'overwrite', 'skip'),
    encoder: choices('libx264', 'h264_nvenc', 'h264_qsv', 'h264_amf'),
  }),
  mixRules: mix,
});
const probe: Check = fields({
  path: text,
  width: positive,
  height: positive,
  codedWidth: optional(positive),
  codedHeight: optional(positive),
  duration: number,
  fps: number,
  codec: text,
  pixFmt: text,
  rotation: number,
  hasAudio: boolean,
  sizeBytes: number,
  modifiedAt: optional(number),
  isImage: boolean,
  tags: (value, path) => {
    for (const [key, entry] of Object.entries(record(value, path))) text(entry, `${path}.${key}`);
  },
});
const item: Check = fields({
  id: identifier,
  slot: number,
  kind,
  title: text,
  sourcePath: nullable(text),
  assetId: optional(identifier),
  status: choices('empty', 'ready', 'missing', 'error'),
  error: optional(text),
  thumbnailUrl: optional(text),
  probe: optional(probe),
  render,
  trim: fields({ in: number, out: number }),
  speed: positive,
  headlineText: optional(text),
  templates: fields(Object.fromEntries(['border', 'watermark', 'headline', 'background'].map((key) => [key, nullable(identifier)]))),
});
const project: Check = fields({
  id: identifier,
  profileId: identifier,
  name: text,
  items: list(item),
  createdAt: text,
  updatedAt: text,
});

export function validateManifest(value: unknown): ProfileArchive {
  fields({ format: choices('oeprofile'), version: choices(2), profile, projects: list(project, 1) })(value, 'profile.json');
  const archive = value as ProfileArchive;
  const account = archive.profile;
  const identifiers = new Set<string>();
  const unique = (id: string) => {
    if (identifiers.has(id)) invalid(`IDs duplicados: ${id}`);
    identifiers.add(id);
  };
  unique(account.id);
  for (const collection of [
    account.assets,
    account.templates,
    account.groups,
    account.fonts,
    account.framingPresets,
    account.textStyles,
    archive.projects,
  ]) {
    for (const entry of collection) unique(entry.id);
  }
  // Removed templates, groups and missing assets retain their historical IDs
  // for recovery. Hydration reports unavailable assets without discarding IDs.
  for (const project of archive.projects) {
    if (project.profileId !== account.id) invalid(`projeto ${project.name}.profileId`);
    for (const item of project.items) {
      unique(item.id);
    }
  }
  return archive;
}
