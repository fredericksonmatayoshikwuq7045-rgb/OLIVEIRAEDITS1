import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { movedRange, trackRange, type Track } from '../domain/timeline';
import type { MediaItem, Profile } from '../domain/models';
import { BACKGROUND_TRACK, MEDIA_TRACK } from '../domain/timeline';
import { TrackFilmstrip } from './TrackFilmstrip';
import { IconButton } from './Primitives';
export function TimelineTrack({
  track,
  item,
  profile,
  onReorder,
  duration,
  step,
  time,
  selected,
  onSelect,
  onCommit,
  onVisible,
}: {
  track: Track;
  item: MediaItem;
  profile: Profile;
  onReorder: (id: string) => void;
  duration: number;
  step: number;
  time: number;
  selected: boolean;
  onSelect: () => void;
  onCommit: (range: { start: number; end: number }, edge: 'start' | 'end' | 'move') => void;
  onVisible: () => void;
}) {
  const actual = trackRange(track, duration),
    [draft, setDraft] = useState(actual);
  const drag = useRef<{ x: number; width: number; edge: 'start' | 'end' | 'move'; range: typeof actual } | null>(null);
  const latest = useRef(draft),
    lane = useRef<HTMLDivElement>(null);
  const { start, end } = actual;
  useEffect(() => {
    const next = { start, end };
    setDraft(next);
    latest.current = next;
  }, [start, end]);
  const outside = draft.start >= duration || draft.end <= 0;
  const finish = () => {
    if (!drag.current) return;
    const edge = drag.current.edge;
    drag.current = null;
    if (latest.current.start !== actual.start || latest.current.end !== actual.end) onCommit(latest.current, edge);
  };
  const key = (event: React.KeyboardEvent<HTMLElement>, edge: 'start' | 'end' | 'move') => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    onCommit(movedRange(actual, (event.key === 'ArrowRight' ? 1 : -1) * step * (event.shiftKey ? 10 : 1), duration, edge, step), edge);
  };
  return (
    <div
      className={`timeline-track-row ${selected ? 'active' : ''}`}
      data-track-id={track.id}
      onDragOver={(event) => {
        if (track.id !== BACKGROUND_TRACK) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const id = event.dataTransfer.getData('application/x-oliveira-track');
        if (id) onReorder(id);
      }}
    >
      <div
        className="timeline-track-heading"
        draggable={track.id !== BACKGROUND_TRACK}
        onDragStart={(event) => event.dataTransfer.setData('application/x-oliveira-track', track.id)}
      >
        <GripVertical size={12} aria-hidden="true" />
        <button
          className="timeline-track-name truncate"
          aria-label={`Selecionar camada ${track.name}`}
          onClick={onSelect}
          title={track.name}
          aria-pressed={selected}
        >
          {track.name}
        </button>
        <span className="badge">
          {track.id === MEDIA_TRACK
            ? 'PRINCIPAL'
            : track.type === 'video'
              ? 'VÍDEO'
              : track.type === 'text'
                ? 'TEXTO'
                : track.type === 'background'
                  ? 'FUNDO'
                  : 'IMAGEM'}
        </span>
        <IconButton label={`${track.visible === false ? 'Mostrar' : 'Ocultar'} ${track.name}`} onClick={onVisible}>
          {track.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
        </IconButton>
      </div>
      <div className="timeline-track-lane" ref={lane}>
        <div className="timeline-track-cursor" style={{ left: `${Math.min(100, Math.max(0, (time / duration) * 100))}%` }} />
        {!outside && (
          <div
            className={`timeline-track-bar ${track.visible === false ? 'hidden-track' : ''}`}
            style={{
              left: `${(Math.max(0, draft.start) / duration) * 100}%`,
              width: `${((Math.min(duration, draft.end) - Math.max(0, draft.start)) / duration) * 100}%`,
            }}
            role="button"
            tabIndex={0}
            aria-label={`Mover ${track.name}`}
            onClick={onSelect}
            onKeyDown={(event) => key(event, 'move')}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              onSelect();
              const edge = (event.target as HTMLElement).closest<HTMLElement>('[data-edge]')?.dataset.edge as 'start' | 'end' | undefined;
              drag.current = { x: event.clientX, width: lane.current!.getBoundingClientRect().width, edge: edge || 'move', range: actual };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const next = movedRange(
                drag.current.range,
                ((event.clientX - drag.current.x) / drag.current.width) * duration,
                duration,
                drag.current.edge,
                step,
              );
              latest.current = next;
              setDraft(next);
            }}
            onPointerUp={finish}
            onLostPointerCapture={finish}
            onPointerCancel={() => {
              drag.current = null;
              setDraft(actual);
              latest.current = actual;
            }}
          >
            <span
              role="slider"
              tabIndex={0}
              data-edge="start"
              aria-label={`Início de ${track.name}`}
              aria-valuemin={0}
              aria-valuemax={draft.end}
              aria-valuenow={draft.start}
              onKeyDown={(event) => {
                event.stopPropagation();
                key(event, 'start');
              }}
              className="track-handle start"
            />
            <TrackFilmstrip track={track} item={item} profile={profile} />
            <span className="track-clip-title truncate">{track.name}</span>
            <span className="track-clip-time">
              {draft.start.toFixed(2)}s — {draft.end.toFixed(2)}s
            </span>
            <span
              role="slider"
              tabIndex={0}
              data-edge="end"
              aria-label={`Fim de ${track.name}`}
              aria-valuemin={draft.start}
              aria-valuemax={duration}
              aria-valuenow={draft.end}
              onKeyDown={(event) => {
                event.stopPropagation();
                key(event, 'end');
              }}
              className="track-handle end"
            />
          </div>
        )}
        {outside && (
          <button className="tiny muted" onClick={onSelect}>
            Fora do trecho · ajustar tempos
          </button>
        )}
      </div>
    </div>
  );
}
