import { createProfile, createProject, isoNow } from '../domain/defaults';
import type { Profile, Workspace } from '../domain/models';
import type { AssetManager } from './assets';
import { exportProfileArchive, importProfileArchive } from './profileArchive';
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
