import { useState } from 'react';
import { isNative } from '../services/native';
import { EditorCenter } from './EditorCenter';
import { EditorDialogs } from './EditorDialogs';
import { EditorProperties } from './EditorProperties';
import { EditorToolbar } from './EditorToolbar';
import { ResourcePanel } from './ResourcePanel';
import { TimelineDock } from './TimelineDock';
import { PanelBoundary } from './PanelBoundary';
import { Button } from './Primitives';
import { appearance } from '../domain/preferences';
import { PanelResize } from './PanelResize';
import { DailyQuote } from './DailyQuote';
import { handleTrackShortcut } from './trackCommands';
import { useEditor, type EditorProps } from './useEditor';
export function Editor(props: EditorProps) {
  const data = useEditor(props),
    [timelineHeight, setTimelineHeight] = useState(220);
  if (!data.profile || !data.project)
    return (
      <div className="empty-state">
        <p>Esta conta não tem um projeto disponível.</p>
        <Button onClick={props.onBack}>Voltar às contas</Button>
      </div>
    );
  const preferences = appearance(data.settings),
    model = { ...data, profile: data.profile, project: data.project };
  const resize = (key: 'libraryWidth' | 'detailsWidth', value: number) =>
    data.onSettings?.({ ...data.settings, ...appearance({ ...preferences, [key]: value }) });
  return (
    <>
      <DailyQuote settings={data.settings} profileId={data.profile.id} compact />
      <EditorToolbar model={model} />
      <div
        className={`editor-shell studio-editor layout-${preferences.layout}`}
        onKeyDown={(event) => {
          if (model.layerId) handleTrackShortcut(event, model);
        }}
        style={
          {
            '--library-width': `${preferences.libraryWidth}px`,
            '--details-width': `${preferences.detailsWidth}px`,
            '--timeline-height': `${timelineHeight}px`,
          } as React.CSSProperties
        }
      >
        <PanelBoundary name="biblioteca">
          <ResourcePanel model={model} />
        </PanelBoundary>
        <PanelResize label="Largura da biblioteca" value={preferences.libraryWidth} onChange={(value) => resize('libraryWidth', value)} />
        <EditorCenter model={model} />
        <PanelResize
          label="Largura das propriedades"
          value={preferences.detailsWidth}
          target=".properties"
          reverse={preferences.layout !== 'right'}
          onChange={(value) => resize('detailsWidth', value)}
        />
        <EditorProperties model={model} />
        <TimelineDock key={model.active?.id || 'empty'} model={model} height={timelineHeight} onHeight={setTimelineHeight} />
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          {model.profile.name} · {model.allItems.length} mídias no projeto
        </span>
        <span>
          {model.engine.info?.available
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
