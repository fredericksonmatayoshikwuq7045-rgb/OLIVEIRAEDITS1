import { useState } from 'react';
import type { AccountTemplate, Profile } from '../domain/models';
import { Button, Field, Modal, Slider, Toggle } from './Primitives';
import { mediaUrl } from '../services/native';

export function TemplateEditor({
  template,
  profile,
  onSave,
  onClose,
}: {
  template: AccountTemplate;
  profile: Profile;
  onSave: (value: AccountTemplate) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(template));
  const patch = (value: Partial<AccountTemplate>) => setDraft((current) => ({ ...current, ...value }));
  const placement = (value: Partial<AccountTemplate['placement']>) => patch({ placement: { ...draft.placement, ...value } });
  return (
    <Modal title="Editar template da conta" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim() });
        }}
      >
        <Field label="Nome do template">
          <input required value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        {draft.mediaType === 'video' ? (
          <video
            className="template-video-preview"
            src={draft.runtimeUrl || mediaUrl(draft.source)}
            controls
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img className="template-video-preview" src={draft.runtimeUrl || mediaUrl(draft.source)} alt="Template" />
        )}
        <Toggle label="Disponível nas alas de vídeos e imagens" checked={draft.shared === true} onChange={(shared) => patch({ shared })} />
        <Field label="Grupo do template">
          <select value={draft.groupId} onChange={(event) => patch({ groupId: event.target.value })}>
            {profile.groups
              .filter((group) => group.type === draft.type)
              .map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Posição padrão X (%)">
            <input
              type="number"
              min={-100}
              max={200}
              step={1}
              value={draft.placement.x * 100}
              onChange={(event) => placement({ x: Number(event.target.value) / 100 })}
            />
          </Field>
          <Field label="Posição padrão Y (%)">
            <input
              type="number"
              min={-100}
              max={200}
              step={1}
              value={draft.placement.y * 100}
              onChange={(event) => placement({ y: Number(event.target.value) / 100 })}
            />
          </Field>
        </div>
        <Slider
          label="Largura padrão (%)"
          value={draft.placement.width * 100}
          min={1}
          max={200}
          onChange={(width) => placement({ width: width / 100 })}
        />
        <Slider
          label="Rotação padrão"
          value={draft.placement.rotation}
          min={-180}
          max={180}
          onChange={(rotation) => placement({ rotation })}
        />
        <Slider
          label="Opacidade padrão"
          value={draft.placement.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(opacity) => placement({ opacity })}
        />
        <Field label="Ordem da camada">
          <input
            type="number"
            min={-100}
            max={1000}
            value={draft.placement.zIndex}
            onChange={(event) => placement({ zIndex: Number(event.target.value) })}
          />
        </Field>
        {draft.category === 'headline' && (
          <>
            <Field label="Headline padrão">
              <textarea value={draft.headlineText ?? ''} onChange={(event) => patch({ headlineText: event.target.value })} />
            </Field>
            <Field label="Fonte da headline">
              <select
                value={draft.headlineFontFamily || 'sans-serif'}
                onChange={(event) => patch({ headlineFontFamily: event.target.value })}
              >
                {[
                  ...new Set([
                    'sans-serif',
                    'Arial',
                    'Impact',
                    ...profile.fonts.map((font) => font.family),
                    draft.headlineFontFamily || 'sans-serif',
                  ]),
                ].map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </Field>
            <Field label="Tamanho da headline (pixels da saída)">
              <input
                type="number"
                min={8}
                max={400}
                value={draft.headlineFontSize ?? 64}
                onChange={(event) => patch({ headlineFontSize: Number(event.target.value) })}
              />
            </Field>
            <Field label="Cor da headline">
              <input
                type="color"
                value={draft.headlineColor || '#ffffff'}
                onChange={(event) => patch({ headlineColor: event.target.value })}
              />
            </Field>
          </>
        )}
        <small>Os valores serão usados ao aplicar este template novamente. As mídias já editadas mantêm suas próprias posições.</small>
        <div className="form-actions">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary">
            Salvar template
          </Button>
        </div>
      </form>
    </Modal>
  );
}
