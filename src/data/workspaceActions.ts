import { createProfile, createProject, isoNow } from '../domain/defaults';
import type { Profile, Workspace } from '../domain/models';
import type { AssetManager } from './assets';
import { exportProfileArchive, importProfileArchive } from './profileArchive';
import { saveAsset } from './assets';
import { withRetainedAssets } from './retainedAssets';
import { hydrateWorkspace } from './workspaceIO';

export interface WorkspaceContext {
  get: () => Workspace | null;
  update: (fn: (value: Workspace) => Workspace) => void;
  manager: () => AssetManager;
  warn: (warnings: string[]) => void;
}
export function profileActions(context: WorkspaceContext) {
  const active = () => {
    const workspace = context.get();
    if (!workspace) throw new Error('Aguarde o carregamento dos dados.');
    return workspace;
  };
  const importProfile = async (bytes: Uint8Array): Promise<string> => {
    const value = await importProfileArchive(bytes);
    const workspace = active();
    value.profile.order = workspace.profiles.length;
    const temporary: Workspace = {
      schemaVersion: 2,
      profiles: [value.profile],
      projects: value.projects,
      activeProfileId: value.profile.id,
      activeProjectByProfile: { [value.profile.id]: value.projects[0]?.id ?? '' },
    };
    const hydrated = await hydrateWorkspace(temporary, context.manager());
    context.warn(hydrated.warnings);
    context.update((current) => ({
      ...current,
      profiles: [...current.profiles, ...hydrated.workspace.profiles],
      projects: [...current.projects, ...hydrated.workspace.projects],
      activeProfileId: value.profile.id,
      activeProjectByProfile: { ...current.activeProjectByProfile, ...temporary.activeProjectByProfile },
    }));
    return value.profile.id;
  };
  return {
    saveAccount: (
      existingId: string | undefined,
      identity: Pick<Profile, 'name' | 'handle' | 'niche' | 'color' | 'notes'>,
      photo?: Blob | null,
    ): Promise<string> =>
      withRetainedAssets(context, async () => {
        const original = existingId
          ? active().profiles.find((profile) => profile.id === existingId)
          : createProfile(identity.name, active().profiles.length);
        if (!original) throw new Error('Esta conta não está mais disponível.');
        const asset = photo
          ? await saveAsset(original.id, new Uint8Array(await photo.arrayBuffer()), 'avatar.png', 'image', 'image/png')
          : undefined;
        if (asset) asset.runtimeUrl = await context.manager().resolve(asset);
        context.update((workspace) => {
          if (existingId && !workspace.profiles.some((profile) => profile.id === existingId))
            throw new Error('A conta foi removida enquanto a foto era preparada.');
          const updated = { ...original, ...identity, avatarAssetId: photo === undefined ? original.avatarAssetId : asset?.id };
          const merge = (profile: Profile) => ({
            ...profile,
            ...identity,
            avatarAssetId: updated.avatarAssetId,
            assets: asset ? [...profile.assets, asset] : profile.assets,
          });
          const project = existingId ? undefined : createProject(original.id);
          return {
            ...workspace,
            profiles: existingId
              ? workspace.profiles.map((profile) => (profile.id === existingId ? merge(profile) : profile))
              : [...workspace.profiles, merge(updated)],
            projects: project ? [...workspace.projects, project] : workspace.projects,
            activeProfileId: project ? original.id : workspace.activeProfileId,
            activeProjectByProfile: project
              ? { ...workspace.activeProjectByProfile, [original.id]: project.id }
              : workspace.activeProjectByProfile,
          };
        });
        return original.id;
      }),
    addReferenceImage: (profileId: string, file: File): Promise<string> =>
      withRetainedAssets(context, async () => {
        if (!active().profiles.some((profile) => profile.id === profileId)) throw new Error('Conta não encontrada.');
        if (file.size > 10 * 1024 * 1024 || !/\.(png|jpe?g|webp)$/i.test(file.name))
          throw new Error('Selecione uma imagem PNG, JPG ou WebP de até 10 MB.');
        const temporary = URL.createObjectURL(file);
        try {
          const image = new Image();
          image.src = temporary;
          await image.decode();
        } finally {
          URL.revokeObjectURL(temporary);
        }
        const asset = await saveAsset(profileId, file, file.name, 'image', file.type);
        asset.runtimeUrl = await context.manager().resolve(asset);
        context.update((workspace) => ({
          ...workspace,
          profiles: workspace.profiles.map((profile) =>
            profile.id === profileId ? { ...profile, assets: [...profile.assets, asset] } : profile,
          ),
        }));
        return asset.id;
      }),
    setProfileAvatar: (profileId: string, photo: Blob | null): Promise<void> =>
      withRetainedAssets(context, async () => {
        if (!active().profiles.some((profile) => profile.id === profileId)) throw new Error('Conta não encontrada.');
        const asset = photo
          ? await saveAsset(profileId, new Uint8Array(await photo.arrayBuffer()), 'avatar.png', 'image', 'image/png')
          : undefined;
        if (asset) asset.runtimeUrl = await context.manager().resolve(asset);
        context.update((workspace) => ({
          ...workspace,
          profiles: workspace.profiles.map((profile) =>
            profile.id === profileId
              ? { ...profile, avatarAssetId: asset?.id, assets: asset ? [...profile.assets, asset] : profile.assets }
              : profile,
          ),
        }));
      }),
    createProfile: (name: string): string => {
      const profile = createProfile(name, active().profiles.length);
      const project = createProject(profile.id);
      context.update((current) => ({
        ...current,
        profiles: [...current.profiles, profile],
        projects: [...current.projects, project],
        activeProfileId: profile.id,
        activeProjectByProfile: { ...current.activeProjectByProfile, [profile.id]: project.id },
      }));
      return profile.id;
    },
    activateProfile: (id: string): void => {
      if (!active().profiles.some((profile) => profile.id === id)) throw new Error('Conta não encontrada.');
      context.update((current) => ({
        ...current,
        activeProfileId: id,
        profiles: current.profiles.map((profile) => (profile.id === id ? { ...profile, lastUsedAt: isoNow() } : profile)),
      }));
    },
    updateProfile: (patch: Partial<Profile>): void =>
      context.update((current) => ({
        ...current,
        profiles: current.profiles.map((profile) =>
          profile.id === current.activeProfileId ? { ...profile, ...patch, id: profile.id } : profile,
        ),
      })),
    archiveProfile: (id: string, archived: boolean): void =>
      context.update((current) => ({
        ...current,
        profiles: current.profiles.map((profile) => (profile.id === id ? { ...profile, archived } : profile)),
      })),
    deleteProfile: (id: string): void =>
      context.update((current) => {
        const profiles = current.profiles.filter((profile) => profile.id !== id);
        const projects = current.projects.filter((project) => project.profileId !== id);
        const { [id]: _removed, ...activeProjectByProfile } = current.activeProjectByProfile;
        // Physical files remain available for undo and manual recovery.
        return {
          ...current,
          profiles,
          projects,
          activeProjectByProfile,
          activeProfileId: current.activeProfileId === id ? (profiles[0]?.id ?? null) : current.activeProfileId,
        };
      }),
    reorderProfiles: (ids: string[]): void =>
      context.update((current) => ({
        ...current,
        profiles: current.profiles.map((profile) => ({
          ...profile,
          order: ids.includes(profile.id) ? ids.indexOf(profile.id) : ids.length + profile.order,
        })),
      })),
    exportProfile: (id: string): Promise<Uint8Array> => exportProfileArchive(active(), id, context.manager()),
    importProfile,
    duplicateProfile: async (id: string): Promise<string> => {
      const original = active().profiles.find((profile) => profile.id === id);
      if (!original) throw new Error('Conta não encontrada.');
      const newId = await importProfile(await exportProfileArchive(active(), id, context.manager()));
      context.update((current) => ({
        ...current,
        profiles: current.profiles.map((profile) => (profile.id === newId ? { ...profile, name: `${original.name} (cópia)` } : profile)),
      }));
      return newId;
    },
  };
}
