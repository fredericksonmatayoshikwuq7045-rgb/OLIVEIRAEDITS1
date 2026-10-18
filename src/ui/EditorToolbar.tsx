import { ArrowLeft, ChevronDown, Download, LayoutPanelLeft, Redo2, Undo2 } from 'lucide-react';
import { ActionMenu } from './ActionMenu';
import { Button, Field, IconButton } from './Primitives';
import type { EditorContext } from './useEditor';
export function EditorToolbar({ model }: { model: EditorContext }) {
  const { active, items, store } = model;
  const sequence = () => {
    if (active)
      model.setCopy({
        source: structuredClone(active),
        ids: items.filter((item) => item.id !== active.id && item.status === 'ready').map((item) => item.id),
        sequence: true,
      });
  };
  return (
    <div className="workflow-bar studio-toolbar">
      <div className="row">
        <IconButton label="Voltar às contas" onClick={model.onBack}>
          <ArrowLeft size={17} />
        </IconButton>
        <strong className="project-title truncate">{model.project.name}</strong>
      </div>
      <div className="row">
        <IconButton label="Desfazer (Ctrl + Z)" disabled={!store.canUndo} onClick={store.undo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Refazer (Ctrl + Shift + Z)" disabled={!store.canRedo} onClick={store.redo}>
          <Redo2 size={16} />
        </IconButton>
        <span className="toolbar-separator" />
        <ActionMenu label="Visualização do editor" icon={<LayoutPanelLeft size={17} />}>
          <Field label="Layout do editor">
            <select
              aria-label="Layout do editor"
              value={model.settings.layout || 'classic'}
              onChange={(event) => model.onSettings?.({ ...model.settings, layout: event.target.value as 'classic' | 'right' | 'focus' })}
            >
              <option value="classic">Player central</option>
              <option value="right">Player à direita</option>
              <option value="focus">Modo foco</option>
            </select>
          </Field>
        </ActionMenu>
        <ActionMenu label="Ações em lote" text="Lote" icon={<ChevronDown size={14} />}>
          <Button disabled={!items.length} onClick={() => model.setAutomation(true)}>
            Assistente em lote
          </Button>
          <Button disabled={!model.selected.length} onClick={() => model.setBatch(true)}>
            Editar seleção em lote
          </Button>
          <Button disabled={!active || items.length < 2} onClick={sequence}>
            Aplicar sequência em massa
          </Button>
          <Button disabled={!items.length} onClick={() => model.openExport(true)}>
            Só limpar metadados
          </Button>
        </ActionMenu>
        <Button variant="primary" disabled={!items.length} onClick={() => model.openExport()}>
          <Download size={15} /> Exportar
        </Button>
      </div>
    </div>
  );
}
