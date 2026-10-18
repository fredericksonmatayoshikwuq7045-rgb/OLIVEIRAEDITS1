import { canvasForAspect } from '../domain/defaults';
import { isNative } from '../services/native';
import { EditorCenter } from './EditorCenter';
import { EditorDialogs } from './EditorDialogs';
import { EditorProperties } from './EditorProperties';
import { EditorToolbar } from './EditorToolbar';
import { Library } from './Library';
import { PanelBoundary } from './PanelBoundary';
import { Button } from './Primitives';
import { appearance } from '../domain/preferences';
import { PanelResize } from './PanelResize';
import { DailyQuote } from './DailyQuote';
import { MediaAreas } from './MediaAreas';
import { applyTemplate } from '../domain/templates';
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
  const preferences = appearance(data.settings);
  const resize = (key: 'libraryWidth' | 'detailsWidth', value: number) =>
    data.onSettings?.({ ...data.settings, ...appearance({ ...preferences, [key]: value }) });
  const model = { ...data, profile: data.profile, project: data.project };
  const { store, active, onTemplate, profile, changeItem, setSaving, setSaveName, notify, engine } = model;
  return (
    <>
      <DailyQuote settings={data.settings} profileId={data.profile.id} compact />
      <MediaAreas model={model} />
      <EditorToolbar model={model} />
      <div
        className={`editor-shell layout-${preferences.layout}`}
        style={
          { '--library-width': `${preferences.libraryWidth}px`, '--details-width': `${preferences.detailsWidth}px` } as React.CSSProperties
        }
      >
        <PanelBoundary name="biblioteca">
          <Library
            store={store}
            item={active}
            onApplyTemplate={onTemplate}
            onAppendTemplate={(id, category) => {
              if (active)
                changeItem(applyTemplate(active, profile.templates.find((template) => template.id === id) || null, category, true));
            }}
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
            kind={model.workspaceKind === 'all' ? active?.kind || 'video' : model.workspaceKind}
          />
        </PanelBoundary>
        <PanelResize label="Largura da biblioteca" value={preferences.libraryWidth} onChange={(value) => resize('libraryWidth', value)} />
        <EditorCenter model={model} />
        <PanelResize
          label="Largura das propriedades"
          value={preferences.detailsWidth}
          reverse
          onChange={(value) => resize('detailsWidth', value)}
        />
        <EditorProperties model={model} />
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          {profile.name} · {model.allItems.length} mídias no projeto
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
