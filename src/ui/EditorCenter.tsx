import { PanelBoundary } from './PanelBoundary';
import { Stage } from './Stage';
import { PlayerTransport } from './PlayerTransport';
import { isNative } from '../services/native';
import { MEDIA_TRACK } from '../domain/timeline';
import { selectEditorTrack } from './trackCommands';
import type { EditorContext } from './useEditor';
export function EditorCenter({ model }: { model: EditorContext }) {
  const { active } = model;
  return (
    <div className="editor-center">
      <div className="stage-toolbar">
        <span className="tiny muted">Player</span>
        <span className="truncate tiny" title={active?.title}>
          {active?.title || model.project.name}
        </span>
      </div>
      <PanelBoundary name="prévia">
        <Stage
          item={active}
          compare={model.compare}
          onSelectLayer={(id) => selectEditorTrack(model, id || MEDIA_TRACK)}
          onContextMenu={(event) => {
            if (active) {
              event.preventDefault();
              model.setMenu({ x: event.clientX, y: event.clientY, item: active });
            }
          }}
          onChange={model.changeItem}
          playing={model.playing}
          time={model.time}
          onTime={model.playTime}
          onEnded={() => model.setPlaying(false)}
          cropMode={model.cropMode}
          cropLocked={model.cropLocked}
          guides={model.guides}
          safeZone={model.safeZone}
          activeLayerId={model.layerId}
          onImport={() => void model.importMedia()}
          onImportFolder={() => void model.importMedia(true)}
          importing={model.importing}
          resolveSource={model.resolveSource}
          notify={model.notify}
          onDropFiles={(files) => {
            if (!isNative()) void model.importFiles(files);
          }}
        />
      </PanelBoundary>
      {active?.status === 'ready' && <PlayerTransport model={model} />}
    </div>
  );
}
