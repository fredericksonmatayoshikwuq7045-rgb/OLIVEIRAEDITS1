import { createRenderSpec } from '../render/types';
import type { AspectRatio, MediaItem, MediaKind, Profile, Project, Workspace } from './models';

export const uid = (): string => crypto.randomUUID();
export const isoNow = (): string => new Date().toISOString();
export function canvasForAspect(aspect: AspectRatio): { width: number; height: number } {
  return {
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
  }[aspect];
}
export function createProfile(name: string, order = 0): Profile {
  const now = isoNow();
  return {
    id: uid(),
    name: name.trim() || 'Nova conta',
    handle: '',
    niche: '',
    color: '#dc2626',
    notes: '',
    archived: false,
    order,
    createdAt: now,
    lastUsedAt: now,
    aspectRatio: '9:16',
    templates: [],
    groups: [],
    assets: [],
    fonts: [],
    framingPresets: [],
    textStyles: [],
    mixRules: {},
    exportSettings: {
      preset: 'standard',
      outputDir: '',
      filenamePattern: '{conta}_{data}_{n}',
      cleanMetadata: true,
      imageFormat: 'png',
      imageQuality: 0.92,
      conflict: 'suffix',
      encoder: 'libx264',
    },
  };
}
export function createProject(profileId: string, name = 'Projeto atual'): Project {
  const now = isoNow();
  return { id: uid(), profileId, name, items: [], createdAt: now, updatedAt: now };
}
export function createWorkspace(): Workspace {
  const profile = createProfile('Padrão');
  const project = createProject(profile.id);
  return {
    schemaVersion: 2,
    profiles: [profile],
    projects: [project],
    activeProfileId: profile.id,
    activeProjectByProfile: { [profile.id]: project.id },
  };
}
export function createMediaItem(kind: MediaKind, slot: number, aspect: AspectRatio = '9:16'): MediaItem {
  const canvas = canvasForAspect(aspect);
  return {
    id: uid(),
    slot,
    kind,
    title: `Mídia ${slot}`,
    sourcePath: null,
    status: 'empty',
    render: createRenderSpec(canvas.width, canvas.height, '', kind),
    trim: { in: 0, out: 0 },
    speed: 1,
    templates: { border: null, watermark: null, headline: null, background: null },
  };
}
