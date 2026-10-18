import { Check, Layers, Plus, Save, Trash2, Type, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AccountTemplate, MediaItem, MediaKind, TemplateCategory } from '../domain/models';
import { mediaKind } from '../data/mediaImport';
import { removeTemplateReferences } from '../domain/templates';
import type { WorkspaceStore } from './Dashboard';
import { TemplateEditor } from './TemplateEditor';
import { TemplateCard } from './TemplateCard';
import { Button, Field, IconButton } from './Primitives';
const labels: Record<TemplateCategory, string> = { border: 'Borda', watermark: 'Marca', headline: 'Headline', background: 'Fundo' };
export function Library({
  store,
  item,
  onApplyTemplate,
  onAppendTemplate,
  onApplyPreset,
  onSavePreset,
  notify,
  kind = 'video',
  view,
  embedded = false,
}: {
  store: WorkspaceStore;
  item: MediaItem | null;
  onApplyTemplate: (id: string | null, category: TemplateCategory) => void;
  onAppendTemplate?: (id: string, category: TemplateCategory) => void;
  onApplyPreset: (id: string) => void;
  onSavePreset: () => void;
  notify: (message: string) => void;
  kind?: MediaKind;
  view?: 'templates' | 'presets' | 'fonts';
  embedded?: boolean;
}) {
  const [internalTab, setTab] = useState<'templates' | 'presets' | 'fonts'>('templates');
  const [category, setCategory] = useState<TemplateCategory>('border');
  const [group, setGroup] = useState('');
  const [editing, setEditing] = useState<AccountTemplate | null>(null);
  const [sourceType, setSourceType] = useState<'all' | MediaKind>('all');
  const templateInput = useRef<HTMLInputElement>(null),
    fontInput = useRef<HTMLInputElement>(null);
  const tab = view || internalTab;
  const profile = store.profile;
  if (!profile) return null;
  const targetKind = item?.kind || kind;
  const groups = profile.groups.filter((g) => g.type === targetKind);
  const effectiveGroup = groups.some((entry) => entry.id === group) ? group : '';
  const templates = profile.templates.filter(
    (t) => t.category === category && (!effectiveGroup || t.groupId === effectiveGroup) && (t.shared || t.type === targetKind),
  );
  return (
    <aside className={`library ${embedded ? 'embedded-library' : ''}`}>
      {!embedded && (
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
      )}
      <div className="library-content">
        {tab === 'templates' && (
          <div className="stack">
            <div className="library-title">
              <h3>Identidade da conta</h3>
              <Layers size={16} className="muted" />
            </div>
            <Field label="Grupo">
              <div className="row">
                <select value={effectiveGroup} onChange={(e) => setGroup(e.target.value)}>
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
                    store.updateProfile({ groups: [...profile.groups, { id, name: name.trim(), type: targetKind }] });
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
                <TemplateCard
                  key={template.id}
                  template={template}
                  selected={item?.templates[category] === template.id}
                  disabled={!item}
                  onApply={() => onApplyTemplate(template.id, category)}
                  onAppend={
                    item && category !== 'background' && onAppendTemplate ? () => onAppendTemplate(template.id, category) : undefined
                  }
                  onEdit={() => setEditing(template)}
                  onRemove={() => {
                    if (!window.confirm(`Remover o template “${template.name}” desta conta?`)) return;
                    store.updateProfile({ templates: profile.templates.filter((t) => t.id !== template.id) });
                    store.updateProject((p) => ({ ...p, items: p.items.map((i) => removeTemplateReferences(i, template.id)) }));
                  }}
                />
              ))}
            </div>
            {templates.length === 0 && <small>Adicione uma imagem ou vídeo com a identidade da sua página.</small>}
            <details className="resource-details">
              <summary>Opções de importação</summary>{' '}
              <Field label="Tipo de template">
                <select value={sourceType} onChange={(event) => setSourceType(event.target.value as typeof sourceType)}>
                  <option value="all">Imagem ou vídeo</option>
                  <option value="image">Template em imagem</option>
                  <option value="video">Template em vídeo</option>
                </select>
              </Field>
            </details>
            <Button onClick={() => templateInput.current?.click()}>
              <Upload /> Adicionar {labels[category].toLocaleLowerCase('pt-BR')}
              {sourceType === 'video' ? ' em vídeo' : ''}
            </Button>
            <input
              hidden
              ref={templateInput}
              aria-label="Arquivo do template"
              type="file"
              accept={sourceType === 'all' ? 'image/*,video/*' : `${sourceType}/*`}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (sourceType !== 'all' && mediaKind(file.name) !== sourceType)
                    throw new Error(`Escolha um template em ${sourceType === 'video' ? 'vídeo' : 'imagem'} ou altere o tipo de template.`);
                  await store.addTemplate(file, category, undefined, targetKind);
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
