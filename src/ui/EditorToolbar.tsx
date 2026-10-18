import { ArrowLeft, Download, Redo2, Undo2 } from 'lucide-react';
import { Button, IconButton } from './Primitives';
import type { EditorContext } from './useEditor';

export function EditorToolbar({ model }: { model: EditorContext }) {
  const { onBack, step, setStep, openExport, store, items } = model;
  return (
    <div className="workflow-bar">
      <div className="row">
        <IconButton label="Voltar às contas" onClick={onBack}>
          <ArrowLeft size={17} />
        </IconButton>
        <div className="workflow-steps">
          {['Mídias', 'Enquadrar', 'Templates / Texto', 'Exportar'].map((label, index) => (
            <div className="row" key={label}>
              <button
                className={`workflow-step ${step === index + 1 ? 'active' : ''}`}
                onClick={() => {
                  setStep(index + 1);
                  if (index === 3) openExport();
                }}
              >
                <span>{index + 1}</span>
                {label}
              </button>
              {index !== 3 && <i className="workflow-divider" />}
            </div>
          ))}
        </div>
      </div>
      <div className="row">
        <Button disabled={!items.length} onClick={() => model.setAutomation(true)}>
          Assistente em lote
        </Button>
        <select
          aria-label="Layout do editor"
          value={model.settings.layout || 'classic'}
          onChange={(event) => model.onSettings?.({ ...model.settings, layout: event.target.value as 'classic' | 'right' | 'focus' })}
          style={{ width: 130 }}
        >
          <option value="classic">Player central</option>
          <option value="right">Player à direita</option>
          <option value="focus">Modo foco</option>
        </select>
        <IconButton label="Desfazer (Ctrl + Z)" disabled={!store.canUndo} onClick={store.undo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Refazer (Ctrl + Shift + Z)" disabled={!store.canRedo} onClick={store.redo}>
          <Redo2 size={16} />
        </IconButton>
        <Button variant="primary" disabled={!items.length} onClick={() => openExport()}>
          <Download /> Exportar
        </Button>
      </div>
    </div>
  );
}
