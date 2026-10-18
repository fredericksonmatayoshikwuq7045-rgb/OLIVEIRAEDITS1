import { useState } from 'react';
import { copyAdjustments, type Adjustment } from '../domain/editing';
import type { MediaItem } from '../domain/models';
import { Button, Modal, Toggle } from './Primitives';
export function CopyAdjustments({
  source,
  targets,
  onApply,
  onClose,
}: {
  source: MediaItem;
  targets: MediaItem[];
  onApply: (items: MediaItem[]) => void;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<Adjustment[]>(['framing']);
  return (
    <Modal title="Aplicar ajustes" onClose={onClose}>
      <div className="stack">
        <p>
          Copiar de <strong>{source.title}</strong> para {targets.length} mídia(s). A ação inteira pode ser desfeita.
        </p>
        {(
          [
            ['framing', 'Enquadramento e recorte'],
            ['layers', 'Textos, logos e templates'],
            ['background', 'Fundo'],
            ['speed', 'Velocidade'],
            ['trim', 'Corte temporal (limitado à duração de cada vídeo)'],
          ] as const
        ).map(([id, label]) => (
          <Toggle
            key={id}
            label={label}
            checked={groups.includes(id)}
            onChange={(checked) => setGroups((old) => (checked ? [...old, id] : old.filter((key) => key !== id)))}
          />
        ))}
        <Button
          variant="primary"
          disabled={!groups.length || !targets.length}
          onClick={() => {
            onApply(targets.map((target) => copyAdjustments(source, target, groups)));
            onClose();
          }}
        >
          Aplicar a {targets.length} mídia(s)
        </Button>
      </div>
    </Modal>
  );
}
