import { Check, Layers, Plus, Save, Settings2, Trash2, Type, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AccountTemplate, MediaItem, TemplateCategory } from '../domain/models';
import { removeTemplateReferences } from '../domain/templates';
import type { WorkspaceStore } from './Dashboard';
import { TemplateEditor } from './TemplateEditor';
import { Button, Field, IconButton } from './Primitives';
const labels: Record<TemplateCategory, string> = { border: 'Borda', watermark: 'Marca', headline: 'Headline', background: 'Fundo' };
export function Library({
  store,
  item,
  onApplyTemplate,
  onApplyPreset,
  onSavePreset,
  notify,
}: {
  store: WorkspaceStore;
  item: MediaItem | null;
  onApplyTemplate: (id: string | null, category: TemplateCategory) => void;
  onApplyPreset: (id: string) => void;
  onSavePreset: () => void;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<'templates' | 'presets' | 'fonts'>('templates');
  const [category, setCategory] = useState<TemplateCategory>('border');
  const [group, setGroup] = useState('');
  const [editing, setEditing] = useState<AccountTemplate | null>(null);
  const templateInput = useRef<HTMLInputElement>(null),
    fontInput = useRef<HTMLInputElement>(null);
  const profile = store.profile;
  if (!profile) return null;
  const groups = profile.groups.filter((g) => !item || g.type === item.kind);
  const templates = profile.templates.filter(
    (t) => t.category === category && (!group || t.groupId === group) && (!item || t.type === item.kind),
  );
  return (
    <aside className="library">
      <nav className="library-tabs" aria-label="Biblioteca">
        <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          Templates
        </button>
        <button className={tab === 'presets' ? 'active' : ''} onClick={() => setTab('presets')}>
          Presets
        </button>
        <button className={tab === 'fonts' ? 'active' : ''} onClick={() => setTab('fonts')}>
          Fontes
        </button>
      </nav>
      <div className="library-content">
        {tab === 'templates' && (
          <div className="stack">
            <div className="library-title">
              <h3>Identidade da conta</h3>
              <Layers size={16} className="muted" />
            </div>
            <Field label="Grupo">
              <div className="row">
                <select value={group} onChange={(e) => setGroup(e.target.value)}>
                  <option value="">Todos os grupos</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <IconButton
                  label="Criar grupo de templates"
                  onClick={() => {
                    const name = window.prompt('Nome do grupo:');
                    if (!name?.trim()) return;
                    const id = crypto.randomUUID();
                    store.updateProfile({ groups: [...profile.groups, { id, name: name.trim(), type: item?.kind || 'video' }] });
                    setGroup(id);
                  }}
                >
                  <Plus size={15} />
                </IconButton>
              </div>
            </Field>
            <div className="mini-tabs">
              {Object.entries(labels).map(([key, label]) => (
                <button key={key} className={category === key ? 'active' : ''} onClick={() => setCategory(key as TemplateCategory)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="template-list">
              <button
                className={`template-card ${!item?.templates[category] ? 'selected' : ''}`}
                disabled={!item}
                onClick={() => onApplyTemplate(null, category)}
              >
                <span className="template-thumb row" style={{ justifyContent: 'center' }}>
                  <Check size={16} />
                </span>
                Sem {labels[category].toLocaleLowerCase('pt-BR')}
              </button>
              {templates.map((template) => (
                <div className="row" key={template.id}>
                  <button
                    className={`template-card ${item?.templates[category] === template.id ? 'selected' : ''}`}
                    disabled={!item}
                    onClick={() => onApplyTemplate(template.id, category)}
                  >
                    {/\.(mp4|mov|webm)$/i.test(template.source) ? (
                      <div className="template-thumb row" style={{ justifyContent: 'center' }}>
                        <Layers size={17} />
                      </div>
                    ) : (
                      <img className="template-thumb" src={template.runtimeUrl || template.source} alt="" />
                    )}
                    <span className="truncate">{template.name}</span>
                  </button>
                  <IconButton label={`Editar template ${template.name}`} onClick={() => setEditing(template)}>
                    <Settings2 size={12} />
                  </IconButton>
                  <IconButton
                    label={`Excluir template ${template.name}`}
                    onClick={() => {
                      if (!window.confirm(`Remover o template “${template.name}” desta conta?`)) return;
                      store.updateProfile({ templates: profile.templates.filter((t) => t.id !== template.id) });
                      store.updateProject((p) => ({ ...p, items: p.items.map((i) => removeTemplateReferences(i, template.id)) }));
                    }}
                  >
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              ))}
            </div>
            {templates.length === 0 && <small>Adicione uma imagem com a identidade da sua página. Fundos também aceitam vídeo.</small>}
            <Button onClick={() => templateInput.current?.click()}>
              <Upload /> Adicionar {labels[category].toLocaleLowerCase('pt-BR')}
            </Button>
            <input
              hidden
              ref={templateInput}
              aria-label="Arquivo do template"
              type="file"
              accept={category === 'background' ? 'image/*,video/*' : 'image/*'}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await store.addTemplate(file, category, undefined, item?.kind || 'video');
                  notify('Template adicionado à biblioteca da conta.');
                } catch (error) {
                  notify(String(error));
                }
                e.target.value = '';
              }}
            />
          </div>
        )}
        {tab === 'presets' && (
          <div className="stack">
            <div className="library-title">
              <h3>Enquadramentos salvos</h3>
              <Save size={15} className="muted" />
            </div>
            {profile.framingPresets.map((preset) => (
              <div className="row" key={preset.id}>
                <button className="template-card" disabled={!item} onClick={() => onApplyPreset(preset.id)}>
                  <span className="grow truncate">{preset.name}</span>
                  <span className="badge">{preset.aspectRatio}</span>
                </button>
                <IconButton
                  label={`Excluir preset ${preset.name}`}
                  onClick={() => store.updateProfile({ framingPresets: profile.framingPresets.filter((p) => p.id !== preset.id) })}
                >
                  <Trash2 size={12} />
                </IconButton>
              </div>
            ))}
            {profile.framingPresets.length === 0 && (
              <small>Salve enquadramentos que você usa sempre, como “Rosto centralizado” ou “Espaço para legenda”.</small>
            )}
            <Button disabled={!item} onClick={onSavePreset}>
              <Plus /> Salvar enquadramento atual
            </Button>
          </div>
        )}
        {tab === 'fonts' && (
          <div className="stack">
            <div className="library-title">
              <h3>Fontes desta conta</h3>
              <Type size={16} className="muted" />
            </div>
            <small>As fontes são armazenadas com o perfil e carregadas antes da renderização.</small>
            {profile.fonts.map((font) => (
              <div className="template-card" key={font.id}>
                <span className="grow" style={{ fontFamily: font.family }}>
                  {font.name}
                </span>
                <IconButton
                  label={`Remover fonte ${font.name}`}
                  onClick={() => store.updateProfile({ fonts: profile.fonts.filter((f) => f.id !== font.id) })}
                >
                  <Trash2 size={12} />
                </IconButton>
              </div>
            ))}
            <Button onClick={() => fontInput.current?.click()}>
              <Upload /> Importar fonte
            </Button>
            <input
              ref={fontInput}
              hidden
              aria-label="Importar fonte"
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await store.addFont(file);
                  notify('Fonte carregada e salva no perfil.');
                } catch (error) {
                  notify(`Não foi possível carregar a fonte: ${String(error)}`);
                }
                e.target.value = '';
              }}
            />
            <small>Formatos: TTF, OTF, WOFF e WOFF2. As fontes do sistema também estão disponíveis no painel de texto.</small>
          </div>
        )}
      </div>
      <footer className="library-footer">
        <span style={{ color: profile.color }}>●</span> Biblioteca exclusiva de <strong>{profile.name}</strong>
        <br />
        {profile.templates.length} templates · {profile.fonts.length} fontes · {profile.framingPresets.length} presets
      </footer>
      {editing && (
        <TemplateEditor
          key={editing.id}
          template={editing}
          profile={profile}
          onClose={() => setEditing(null)}
          onSave={(updated) => {
            store.updateProfile({ templates: profile.templates.map((template) => (template.id === updated.id ? updated : template)) });
            setEditing(null);
            notify('Template atualizado na conta.');
          }}
        />
      )}
    </aside>
  );
}
