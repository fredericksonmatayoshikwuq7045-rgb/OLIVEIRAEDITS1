import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspace } from '../domain/defaults';
import { AssetManager, saveAsset } from './assets';
import { profileActions, type WorkspaceContext } from './workspaceActions';
vi.mock('./assets', async (original) => ({ ...(await original<typeof import('./assets')>()), saveAsset: vi.fn() }));
const identity = { name: 'Nova conta', handle: '@nova', color: '#ed4355', niche: 'Teste', notes: '' };
function setup() {
  let workspace = createWorkspace();
  const manager = new AssetManager();
  vi.spyOn(manager, 'resolve').mockResolvedValue('blob:prepared');
  const context: WorkspaceContext = {
    get: () => workspace,
    manager: () => manager,
    update: (fn) => {
      workspace = fn(workspace);
    },
    warn: vi.fn(),
  };
  return { actions: profileActions(context), get: () => workspace };
}
beforeEach(() => {
  vi.clearAllMocks();
});
describe('salvar conta e foto em uma única alteração', () => {
  it('uma falha ao salvar foto não cria uma conta incompleta nem altera a conta anterior', async () => {
    const state = setup(),
      original = structuredClone(state.get());
    vi.mocked(saveAsset).mockRejectedValue(new Error('Disco indisponível'));
    await expect(state.actions.saveAccount(undefined, identity, new Blob(['PNG']))).rejects.toThrow('Disco indisponível');
    expect(state.get()).toEqual(original);
  });
  it('publica perfil, projeto e referência da foto juntos após preparar o asset', async () => {
    const state = setup();
    const assetId = crypto.randomUUID();
    vi.mocked(saveAsset).mockImplementation(async (profileId) => ({
      id: assetId,
      relativePath: `profiles/${profileId}/assets/avatar.png`,
      source: 'owned/avatar.png',
      name: 'avatar.png',
      kind: 'image',
      mimeType: 'image/png',
    }));
    const id = await state.actions.saveAccount(undefined, identity, new Blob(['PNG']));
    const account = state.get().profiles.find((profile) => profile.id === id)!;
    expect(account).toMatchObject({ ...identity, avatarAssetId: assetId });
    expect(account.assets[0].id).toBe(assetId);
    expect(state.get().projects.find((project) => project.id === state.get().activeProjectByProfile[id])?.profileId).toBe(id);
    expect(state.get().profiles).toHaveLength(2);
  });
});
