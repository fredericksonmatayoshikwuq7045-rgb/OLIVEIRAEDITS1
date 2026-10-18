import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import type { MediaItem, Profile } from '../domain/models';
import {
  BACKGROUND_TRACK,
  MEDIA_TRACK,
  MAX_TIME,
  compositionDuration,
  editTrackRange,
  outputTime,
  patchTrack,
  playerTime,
  reorderTrack,
  timelineTracks,
  trackRange,
  type Track,
} from '../domain/timeline';
import { Button, IconButton } from './Primitives';
import { TimelineTrack } from './TimelineTrack';
import { TrackInspector } from './TrackInspector';
export function LayerTimeline({
  item,
  profile,
  time,
  selectedId,
  onSelect,
  onChange,
  onTime,
  onApply,
}: {
  item: MediaItem;
  profile: Profile;
  time: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (item: MediaItem) => void;
  onTime: (time: number) => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(true),
    [zoom, setZoom] = useState(70),
    [extra, setExtra] = useState(0);
  const duration = compositionDuration(item),
    tracks = timelineTracks(item, profile),
    elapsed = outputTime(item, time);
  const horizon = Math.min(MAX_TIME, duration + Math.max(2, duration * 0.15) + extra),
    width = Math.min(200000, Math.max(480, horizon * zoom));
  const selected = tracks.find((track) => track.id === (selectedId || MEDIA_TRACK));
  const latest = useRef(item);
  latest.current = item;
  const step = 1 / (item.probe?.fps || 30),
    tick = Math.max(1, Math.ceil(80 / (width / horizon)), Math.ceil(horizon / 100));
  const seek = (seconds: number) => onTime(playerTime(item, Math.max(0, Math.min(duration - 0.001, seconds))));
  const select = (track: Track) => {
    onSelect(track.id);
    const range = trackRange(track, duration);
    if (elapsed < range.start || elapsed >= range.end) seek(range.start);
  };
  return (
    <section className="layer-timeline" aria-label="Timeline das camadas">
      <div className="row-between timeline-tools">
        <div className="row">
          <IconButton label={open ? 'Recolher camadas da timeline' : 'Expandir camadas da timeline'} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </IconButton>
          <h3>Camadas ({tracks.length})</h3>
          <small>{duration.toFixed(2)}s</small>
        </div>
        <div className="row">
          <IconButton label="Diminuir zoom da timeline" disabled={zoom <= 10} onClick={() => setZoom((value) => Math.max(10, value / 1.5))}>
            <Minus size={14} />
          </IconButton>
          <IconButton
            label="Aumentar zoom da timeline"
            disabled={zoom >= 400}
            onClick={() => setZoom((value) => Math.min(400, value * 1.5))}
          >
            <Plus size={14} />
          </IconButton>
          <Button onClick={() => setExtra((value) => value + 5)}>+5s de espaço</Button>
          <Button onClick={onApply}>Aplicar sequência em massa</Button>
        </div>
      </div>
      {open && (
        <>
          <small>Arraste os clipes e suas pontas. Arraste os nomes para mudar a ordem visual; a camada de cima aparece na frente.</small>
          <div className="timeline-scroll" aria-label="Faixas da composição">
            <div style={{ width: width + 164 }}>
              <div className="timeline-ruler-row">
                <span className="timeline-label">Camada / ordem</span>
                <div
                  className="layer-time-ruler"
                  role="slider"
                  tabIndex={0}
                  aria-label="Cursor das camadas"
                  aria-valuemin={0}
                  aria-valuemax={duration}
                  aria-valuenow={Math.max(0, elapsed)}
                  onPointerDown={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    seek(((event.clientX - bounds.left) / bounds.width) * horizon);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                      event.preventDefault();
                      seek(elapsed + (event.key === 'ArrowRight' ? step : -step));
                    }
                  }}
                >
                  {Array.from({ length: Math.floor(horizon / tick) + 1 }, (_, index) => (
                    <span key={index} style={{ left: `${((index * tick) / horizon) * 100}%` }}>
                      {index * tick}s
                    </span>
                  ))}
                  <i style={{ left: `${(Math.max(0, elapsed) / horizon) * 100}%` }} />
                </div>
              </div>
              <div className="timeline-track-list">
                {tracks.map((track) => (
                  <TimelineTrack
                    key={track.id}
                    track={{ ...track, enable: trackRange(track, duration) }}
                    item={item}
                    profile={profile}
                    duration={horizon}
                    step={step}
                    time={elapsed}
                    selected={track.id === (selectedId || MEDIA_TRACK)}
                    onSelect={() => select(track)}
                    onVisible={() => onChange(patchTrack(latest.current, track.id, { visible: track.visible === false }))}
                    onCommit={(range, edge) => onChange(editTrackRange(latest.current, track.id, range, edge))}
                    onReorder={(id) => {
                      if (id !== BACKGROUND_TRACK) onChange(reorderTrack(latest.current, id, track.id));
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          {selected && (
            <TrackInspector item={item} profile={profile} selected={selected} time={elapsed} onChange={onChange} onSelect={onSelect} />
          )}
        </>
      )}
    </section>
  );
}
