import { Copy, Maximize2, Minimize2, Scissors, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { MEDIA_TRACK } from '../domain/timeline';
import { ActionMenu } from './ActionMenu';
import { Button, IconButton } from './Primitives';
import { MediaContextMenu } from './MediaContextMenu';
import { LayerTimeline } from './LayerTimeline';
import { handleTrackShortcut, runTrackCommand, selectEditorTrack, trackOptions } from './trackCommands';
import type { EditorContext } from './useEditor';
export function TimelineDock({ model, height, onHeight }: { model: EditorContext; height: number; onHeight: (value: number) => void }) {
  const drag = useRef<{ y: number; height: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const item = model.active,
    selectedId = model.layerId || MEDIA_TRACK;
  const options = trackOptions(model, selectedId),
    split = options.find((option) => option.id === 'split');
  const resize = (value: number, element: HTMLElement) =>
    onHeight(Math.max(136, Math.min(460, element.closest('.editor-shell')!.clientHeight - 260, value)));
  return (
    <section
      className="composition-timeline studio-timeline"
      aria-label="Montagem da mídia"
      onKeyDown={(event) => handleTrackShortcut(event, model)}
    >
      <div
        className="timeline-resize"
        role="separator"
        aria-label="Altura da timeline"
        aria-orientation="horizontal"
        aria-valuemin={136}
        aria-valuemax={460}
        aria-valuenow={height}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          drag.current = { y: event.clientY, height };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current) resize(drag.current.height + drag.current.y - event.clientY, event.currentTarget);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            resize(height + (event.key === 'ArrowUp' ? 20 : -20), event.currentTarget);
          }
        }}
      />
      {item?.status === 'ready' ? (
        <LayerTimeline
          item={item}
          profile={model.profile}
          time={model.time}
          selectedId={model.layerId}
          onSelect={(id) => selectEditorTrack(model, id)}
          onChange={model.changeItem}
          onTime={(value) => {
            model.setTime(value);
            if (item.kind === 'image') model.changeItem({ ...item, imageTime: value });
          }}
          onContextMenu={(event, id) => {
            event.preventDefault();
            selectEditorTrack(model, id);
            setMenu({ x: event.clientX, y: event.clientY, id });
          }}
          actions={
            <>
              <IconButton
                label={split?.label || 'Dividir camada no cursor'}
                disabled={!split || split.disabled}
                onClick={() => runTrackCommand(model, selectedId, 'split')}
              >
                <Scissors size={14} />
              </IconButton>
              <IconButton
                label={selectedId === MEDIA_TRACK ? 'Remover mídia do projeto' : 'Remover camada da timeline'}
                onClick={() => runTrackCommand(model, selectedId, 'remove')}
              >
                <Trash2 size={14} />
              </IconButton>
              <ActionMenu label="Opções da camada">
                {options.map((option) => (
                  <Button
                    key={option.id}
                    disabled={option.disabled}
                    className={option.id === 'remove' ? 'danger-text' : ''}
                    onClick={() => runTrackCommand(model, selectedId, option.id)}
                  >
                    {option.id === 'duplicate' && <Copy size={13} />} {option.label}
                  </Button>
                ))}
              </ActionMenu>
            </>
          }
          expand={
            <IconButton
              label={height > 240 ? 'Reduzir timeline' : 'Expandir timeline'}
              aria-expanded={height > 240}
              onClick={() => onHeight(height > 240 ? 190 : 320)}
            >
              {height > 240 ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </IconButton>
          }
        />
      ) : (
        <div className="timeline-placeholder">
          <strong>Timeline</strong>
          <span>Importe uma mídia para começar sua montagem.</span>
        </div>
      )}
      {item && menu && (
        <MediaContextMenu
          menu={{ ...menu, item }}
          title="Ações da camada"
          entries={trackOptions(model, menu.id)}
          onClose={() => setMenu(null)}
          onAction={(command) => runTrackCommand(model, menu.id, command)}
        />
      )}
    </section>
  );
}
