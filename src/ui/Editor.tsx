import { canvasForAspect } from '../domain/defaults';
import { isNative } from '../services/native';
import { EditorCenter } from './EditorCenter';
import { EditorDialogs } from './EditorDialogs';
import { EditorProperties } from './EditorProperties';
import { EditorToolbar } from './EditorToolbar';
import { Library } from './Library';
import { PanelBoundary } from './PanelBoundary';
import { Button } from './Primitives';
import { useEditor, type EditorProps } from './useEditor';
export function Editor(props: EditorProps) {
  const data = useEditor(props);
  if (!data.profile || !data.project)
    return (
      <div className="empty-state">
        <p>Esta conta não tem um projeto disponível.</p>
        <Button onClick={props.onBack}>Voltar às contas</Button>
      </div>
    );
  const model = { ...data, profile: data.profile, project: data.project };
  const { store, active, onTemplate, profile, changeItem, setSaving, setSaveName, notify, items, engine } = model;
  return (
    <>
      <EditorToolbar model={model} />
      <div className="editor-shell">
        <PanelBoundary name="biblioteca">
          <Library
            store={store}
            item={active}
            onApplyTemplate={onTemplate}
            onApplyPreset={(id) => {
              const preset = profile.framingPresets.find((p) => p.id === id);
              if (preset && active)
                changeItem({
                  ...active,
                  render: {
                    ...active.render,
                    canvas: canvasForAspect(preset.aspectRatio),
                    media: {
                      ...active.render.media,
                      ...preset.media,
                      source: active.render.media.source,
                      width: active.render.media.width,
                      height: active.render.media.height,
                      type: active.render.media.type,
                    },
                  },
                });
            }}
            onSavePreset={() => {
              setSaving('preset');
              setSaveName('');
            }}
            notify={notify}
          />
        </PanelBoundary>
        <EditorCenter model={model} />
        <EditorProperties model={model} />
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          {profile.name} · {items.length} mídias no projeto
        </span>
        <span>
          {engine.info?.available
            ? 'Motor FFmpeg disponível'
            : isNative()
              ? 'Exportação de vídeo indisponível · veja Configurações'
              : 'Modo navegador · vídeos exigem aplicativo desktop'}
        </span>
        <span>Ctrl + Z desfazer · ? atalhos</span>
      </footer>
      <EditorDialogs model={model} />
    </>
  );
}
