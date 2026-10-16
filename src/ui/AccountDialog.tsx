import { useState } from 'react';
import type { Profile } from '../domain/models';
import { Button, Field, Modal } from './Primitives';
export type AccountIdentity = Pick<Profile, 'name' | 'handle' | 'niche' | 'color' | 'notes'>;
export function AccountDialog({
  profile,
  onSave,
  onClose,
}: {
  profile?: Profile;
  onSave: (identity: AccountIdentity) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AccountIdentity>({
    name: profile?.name ?? '',
    handle: profile?.handle ?? '',
    niche: profile?.niche ?? '',
    color: profile?.color ?? '#ed4355',
    notes: profile?.notes ?? '',
  });
  const patch = (value: Partial<AccountIdentity>) => setDraft((p) => ({ ...p, ...value }));
  return (
    <Modal title={profile ? 'Editar conta' : 'Criar uma conta'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim() });
        }}
        className="stack"
      >
        <p className="muted">Cada conta tem seus próprios templates, fontes, projeto e pasta de saída.</p>
        <Field label="Nome da conta">
          <input
            autoFocus
            required
            maxLength={100}
            placeholder="Ex.: Histórias do futebol"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="@ da página">
            <input placeholder="@minhapagina" value={draft.handle} onChange={(e) => patch({ handle: e.target.value })} />
          </Field>
          <Field label="Nicho ou tema">
            <input placeholder="Ex.: Esportes" value={draft.niche} onChange={(e) => patch({ niche: e.target.value })} />
          </Field>
        </div>
        <Field label="Cor da identidade">
          <input type="color" value={draft.color} onChange={(e) => patch({ color: e.target.value })} />
        </Field>
        <Field label="Observações">
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Tom de voz, referências, orientações…"
          />
        </Field>
        <div className="form-actions">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={!draft.name.trim()}>
            {profile ? 'Salvar alterações' : 'Criar conta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
