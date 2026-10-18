import { Button, Modal } from './Primitives';
import type { EditorContext } from './useEditor';

export function ClearMediaDialog({ model }: { model: EditorContext }) {
  const quantity = `${model.items.length} mídia${model.items.length === 1 ? '' : 's'}`;
  return (
    <Modal title="Limpar todas as mídias?" onClose={() => model.setClearProjectId(null)}>
      <div className="stack">
        <p>
          Remover <strong>{quantity}</strong> do projeto <strong>{model.project.name}</strong> para começar uma nova leva?
        </p>
        <p className="muted">
          Os arquivos originais, foto, templates, fontes e configurações do perfil serão preservados. Você pode desfazer com Ctrl + Z
          enquanto o aplicativo estiver aberto.
        </p>
        {model.importing && <p role="status">Aguarde a importação terminar para limpar as mídias.</p>}
        {model.previewBusy && <p role="status">Aguarde a prévia terminar para limpar as mídias.</p>}
        <div className="form-actions">
          <Button onClick={() => model.setClearProjectId(null)}>Cancelar</Button>
          <Button variant="danger" disabled={model.importing || model.previewBusy || !model.items.length} onClick={model.clearMedia}>
            Limpar {quantity}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
