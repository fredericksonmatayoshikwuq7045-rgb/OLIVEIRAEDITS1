import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Copy,
  Download,
  Film,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { useWorkspace } from '../data/useWorkspace';
import type { Profile } from '../domain/models';
import { appearance, type UiSettings } from '../domain/preferences';
import { DailyQuote } from './DailyQuote';
import { MatrixBackground } from './MatrixBackground';
import { AccountDialog, type AccountIdentity } from './AccountDialog';
import { Button, IconButton, Modal } from './Primitives';
export type WorkspaceStore = ReturnType<typeof useWorkspace>;
export function downloadBytes(bytes: Uint8Array, name: string, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Dashboard({
  store,
  onOpen,
  onSettings,
  notify,
  settings = { concurrency: 1, confirmExport: true },
}: {
  store: WorkspaceStore;
  onOpen: (id: string) => void;
  onSettings: () => void;
  notify: (message: string) => void;
  settings?: UiSettings;
}) {
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Profile | 'new' | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const root = menuRoot.current,
      trigger = root?.querySelector('button');
    root?.querySelector<HTMLButtonElement>('.dropdown-menu button')?.focus();
    const outside = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) setMenu(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
        trigger?.focus();
      }
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', key);
    };
  }, [menu]);
  const workspace = store.workspace;
  if (!workspace) return null;
  const profiles = [...workspace.profiles].sort((a, b) => a.order - b.order);
  const filtered = profiles.filter(
    (p) =>
      p.archived === archived && `${p.name} ${p.handle} ${p.niche}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  );
  const saveIdentity = async (identity: AccountIdentity, photo?: Blob | null) => {
    await store.saveAccount(editing === 'new' ? undefined : editing?.id, identity, photo);
    setEditing(null);
    notify(editing === 'new' ? 'Conta criada. Sua biblioteca está pronta.' : 'Conta atualizada.');
  };
  const backup = async (profile: Profile) => {
    try {
      downloadBytes(await store.exportProfile(profile.id), `${profile.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}.oeprofile`);
      notify('Backup do perfil preparado.');
    } catch (error) {
      notify(String(error));
    }
    setMenu(null);
  };
  const reorder = (id: string, delta: number) => {
    const ids = profiles.map((p) => p.id);
    const index = ids.indexOf(id),
      target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    store.reorderProfiles(ids);
  };
  return (
    <main className="dashboard">
      <MatrixBackground enabled={appearance(settings).animation && !settings.performance} />
      <div className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">SEU ESTÚDIO, ORGANIZADO</span>
            <h1>Uma identidade para cada conta.</h1>
            <p className="muted">Escolha uma página e continue de onde parou.</p>
          </div>
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus /> Nova conta
          </Button>
        </div>
        <DailyQuote settings={settings} />
        <div className="dashboard-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Buscar contas por nome ou nicho"
              placeholder="Buscar nome, @ ou nicho…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="row">
            <Button variant={archived ? 'secondary' : 'ghost'} onClick={() => setArchived((v) => !v)}>
              <Archive />
              {archived ? 'Ver contas ativas' : 'Arquivadas'}
            </Button>
            <Button variant="ghost" onClick={() => input.current?.click()}>
              <Upload /> Importar perfil
            </Button>
            <IconButton label="Configurações" onClick={onSettings}>
              <Settings size={18} />
            </IconButton>
          </div>
        </div>
        <input
          hidden
          type="file"
          accept=".oeprofile"
          ref={input}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              await store.importProfile(new Uint8Array(await file.arrayBuffer()));
              notify('Perfil importado com segurança.');
            } catch (error) {
              notify(String(error));
            }
            e.target.value = '';
          }}
        />
        <div className="accounts-grid">
          {filtered.map((profile) => {
            const project = workspace.projects.find((p) => p.id === workspace.activeProjectByProfile[profile.id]);
            const mediaCount = project?.items.filter((item) => item.status !== 'empty').length ?? 0;
            const avatar = profile.assets.find((asset) => asset.id === profile.avatarAssetId);
            return (
              <article className="account-card" key={profile.id} style={{ '--account-color': profile.color } as React.CSSProperties}>
                <div className="account-card-top">
                  <div className="account-avatar" style={{ background: `${profile.color}22`, color: profile.color }}>
                    {avatar?.runtimeUrl ? <img src={avatar.runtimeUrl} alt="" /> : profile.name.slice(0, 2).toLocaleUpperCase('pt-BR')}
                  </div>
                  <div className="account-menu" ref={menu === profile.id ? menuRoot : undefined}>
                    <IconButton
                      label={`Opções de ${profile.name}`}
                      aria-expanded={menu === profile.id}
                      onClick={() => setMenu(menu === profile.id ? null : profile.id)}
                    >
                      <MoreHorizontal size={19} />
                    </IconButton>
                    {menu === profile.id && (
                      <div className="dropdown-menu">
                        <button
                          onClick={() => {
                            setEditing(profile);
                            setMenu(null);
                          }}
                        >
                          Editar conta
                        </button>
                        <button
                          onClick={() => {
                            void store
                              .duplicateProfile(profile.id)
                              .then(() => notify('Conta duplicada.'))
                              .catch((error) => notify(String(error)));
                            setMenu(null);
                          }}
                        >
                          <Copy size={13} /> Duplicar
                        </button>
                        <button onClick={() => void backup(profile)}>
                          <Download size={13} /> Exportar perfil
                        </button>
                        <button
                          onClick={() => {
                            store.archiveProfile(profile.id, !profile.archived);
                            setMenu(null);
                          }}
                        >
                          <Archive size={13} />
                          {profile.archived ? 'Restaurar' : 'Arquivar'}
                        </button>
                        <div className="row">
                          <IconButton label="Mover conta para cima" onClick={() => reorder(profile.id, -1)}>
                            <ArrowUp size={14} />
                          </IconButton>
                          <IconButton label="Mover conta para baixo" onClick={() => reorder(profile.id, 1)}>
                            <ArrowDown size={14} />
                          </IconButton>
                        </div>
                        <button
                          className="danger-text"
                          onClick={() => {
                            setDeleting(profile);
                            setMenu(null);
                          }}
                        >
                          <Trash2 size={13} /> Excluir conta
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <h2>{profile.name}</h2>
                <p className="account-handle">{profile.handle || 'Sem @ definido'}</p>
                {profile.niche && <span className="niche-tag">{profile.niche}</span>}
                <div className="account-stats">
                  <span>
                    <Film size={14} /> {mediaCount} mídias
                  </span>
                  <span>{profile.templates.length} templates</span>
                </div>
                <footer>
                  <small>Último uso: {new Date(profile.lastUsedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small>
                  <button className="account-open" onClick={() => onOpen(profile.id)} aria-label={`Abrir editor de ${profile.name}`}>
                    <ArrowRight size={18} />
                  </button>
                </footer>
              </article>
            );
          })}
          <button className="account-add" onClick={() => setEditing('new')}>
            <Plus size={27} />
            <strong>Criar uma conta</strong>
            <span>Templates e projetos em um só lugar</span>
          </button>
        </div>
        {filtered.length === 0 && <p className="muted">{archived ? 'Nenhuma conta arquivada.' : 'Nenhuma conta corresponde à busca.'}</p>}
        <div className="dashboard-footnote">
          <FolderOpen size={16} />
          <p>Seus arquivos continuam no computador. Cada conta mantém sua biblioteca e suas configurações de exportação.</p>
        </div>
      </div>
      {editing && (
        <AccountDialog profile={editing === 'new' ? undefined : editing} onSave={saveIdentity} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <Modal title="Excluir conta?" onClose={() => setDeleting(null)}>
          <div className="stack">
            <p>
              Excluir <strong>{deleting.name}</strong> remove os projetos e a biblioteca dessa conta. Os arquivos de mídia originais
              permanecem no computador.
            </p>
            <p className="notice">Exporte um backup do perfil antes de continuar se quiser recuperá-lo depois.</p>
            <div className="form-actions">
              <Button onClick={() => void backup(deleting)}>
                <Download /> Fazer backup
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  store.deleteProfile(deleting.id);
                  setDeleting(null);
                }}
              >
                Excluir conta
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
