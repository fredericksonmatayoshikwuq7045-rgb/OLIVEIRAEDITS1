import type { MarkRule } from './automation';
import type { RenderSpec } from '../render/types';

export type MediaKind = 'video' | 'image';
export type TemplateCategory = 'border' | 'watermark' | 'headline' | 'background';
export type MixMode = 'fixed' | 'sequential' | 'random' | 'no-repeat';
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export interface MediaProbe {
  path: string;
  width: number;
  height: number;
  codedWidth?: number;
  codedHeight?: number;
  duration: number;
  fps: number;
  codec: string;
  pixFmt: string;
  rotation: number;
  hasAudio: boolean;
  tags: Record<string, string>;
  sizeBytes: number;
  modifiedAt?: number;
  isImage: boolean;
}

export interface AssetRef {
  id: string;
  relativePath: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video' | 'font';
  source: string;
  runtimeUrl?: string;
}

export interface TemplateGroup {
  id: string;
  name: string;
  type: MediaKind;
  legacyPayload?: unknown;
}

export interface AccountTemplate {
  id: string;
  name: string;
  groupId: string;
  category: TemplateCategory;
  type: MediaKind;
  mediaType?: MediaKind;
  sourceWidth?: number;
  sourceHeight?: number;
  assetId?: string;
  source: string;
  runtimeUrl?: string;
  placement: { x: number; y: number; width: number; rotation: number; opacity: number; zIndex: number };
  headlineText?: string;
  headlineFontFamily?: string;
  headlineFontSize?: number;
  headlineColor?: string;
  headlineAlign?: 'left' | 'center' | 'right';
  legacyPayload?: unknown;
}

export interface FontAsset {
  id: string;
  name: string;
  family: string;
  assetId: string;
}
export interface FramingPreset {
  id: string;
  name: string;
  media: RenderSpec['media'];
  aspectRatio: AspectRatio;
}
export interface TextStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  strokeColor?: string;
  strokeWidth?: number;
}
export interface ExportSettings {
  preset: 'fast' | 'standard' | 'high' | 'nvenc';
  outputDir: string;
  filenamePattern: string;
  cleanMetadata: boolean;
  imageFormat: 'png' | 'jpeg' | 'webp';
  imageQuality: number;
  conflict: 'suffix' | 'overwrite' | 'skip';
  encoder: 'libx264' | 'h264_nvenc' | 'h264_qsv' | 'h264_amf';
}
export interface MixRule {
  mode: MixMode;
  seed: number;
  templateIds: string[];
}
export interface Profile {
  id: string;
  name: string;
  handle: string;
  niche: string;
  color: string;
  avatarAssetId?: string;
  markRule?: MarkRule;
  notes: string;
  archived: boolean;
  order: number;
  createdAt: string;
  lastUsedAt: string;
  aspectRatio: AspectRatio;
  templates: AccountTemplate[];
  groups: TemplateGroup[];
  assets: AssetRef[];
  fonts: FontAsset[];
  framingPresets: FramingPreset[];
  textStyles: TextStyle[];
  exportSettings: ExportSettings;
  mixRules: Partial<Record<TemplateCategory, MixRule>>;
}

export interface MediaItem {
  id: string;
  slot: number;
  kind: MediaKind;
  title: string;
  sourcePath: string | null;
  assetId?: string;
  runtimeUrl?: string;
  thumbnailUrl?: string;
  probe?: MediaProbe;
  status: 'empty' | 'ready' | 'missing' | 'error';
  error?: string;
  render: RenderSpec;
  trim: { in: number; out: number };
  speed: number;
  headlineText?: string;
  templates: Record<TemplateCategory, string | null>;
  legacyPayload?: unknown;
}

export interface Project {
  id: string;
  profileId: string;
  name: string;
  items: MediaItem[];
  createdAt: string;
  updatedAt: string;
}
export interface MigrationReport {
  version: 1;
  migratedAt: string;
  backupPath: string;
  counts: { videos: number; images: number; templates: number; groups: number; recoveredFiles: number };
  warnings: string[];
  complete: boolean;
}
export interface Workspace {
  schemaVersion: 2;
  profiles: Profile[];
  projects: Project[];
  activeProfileId: string | null;
  activeProjectByProfile: Record<string, string>;
  migration?: MigrationReport;
}
