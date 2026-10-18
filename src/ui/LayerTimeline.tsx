import { Minus, Plus, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { ActionMenu } from './ActionMenu';
export function LayerTimeline({
  item,
  profile,
  time,
  selectedId,
  onSelect,
  onChange,
  onTime,
  actions,
  expand,
  onContextMenu,
}: {
  item: MediaItem;
  profile: Profile;
  time: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (item: MediaItem) => void;
  onTime: (time: number) => void;
  actions: ReactNode;
  expand: ReactNode;
  onContextMenu: (event: React.MouseEvent, id: string) => void;
}) {
  const [open, setOpen] = useState(true),
    [zoom, setZoom] = useState(70),
    [extra, setExtra] = useState(0),
    [fit, setFit] = useState(true),
    [viewWidth, setViewWidth] = useState(1000),
    [showBackground, setShowBackground] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setViewWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);
  const duration = compositionDuration(item),
    tracks = timelineTracks(item, profile).filter(
      (track) =>
        track.id !== BACKGROUND_TRACK ||
        showBackground ||
        selectedId === BACKGROUND_TRACK ||
        item.render.background.type !== 'solid' ||
        item.render.background.color !== '#111111' ||
        !!item.render.background.enable,
    ),
    elapsed = outputTime(item, time);
  const horizon = Math.min(MAX_TIME, duration + Math.min(2, duration * 0.1) + extra),
    width = Math.min(200000, Math.max(120, fit ? viewWidth - 164 : horizon * zoom));
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
          <h3>Timeline</h3>
          <span className="toolbar-separator" />
          {actions}
        </div>
        <div className="row timeline-view-tools">
          <IconButton label="Ajustar timeline à janela" aria-pressed={fit} onClick={() => setFit(true)}>
            <ScanLine size={14} />
          </IconButton>
          <IconButton
            label="Diminuir zoom da timeline"
            disabled={!fit && zoom <= 10}
            onClick={() => {
              setFit(false);
              setZoom((value) => Math.max(10, (fit ? width / horizon : value) / 1.5));
            }}
          >
            <Minus size={14} />
          </IconButton>
          <input
            aria-label="Zoom da timeline"
            type="range"
            min={10}
            max={2000}
            step={5}
            value={Math.max(10, Math.min(2000, fit ? width / horizon : zoom))}
            onChange={(event) => {
              setFit(false);
              setZoom(Number(event.target.value));
            }}
          />
          <IconButton
            label="Aumentar zoom da timeline"
            disabled={!fit && zoom >= 2000}
            onClick={() => {
              setFit(false);
              setZoom((value) => Math.min(2000, (fit ? width / horizon : value) * 1.5));
            }}
          >
            <Plus size={14} />
          </IconButton>
          <ActionMenu label="Opções da timeline">
            <Button onClick={() => setExtra((value) => value + 5)}>+5s de espaço</Button>
            <Button onClick={() => setShowBackground((value) => !value)}>{showBackground ? 'Ocultar' : 'Mostrar'} fundo sólido</Button>
            <Button onClick={() => onSelect(BACKGROUND_TRACK)}>Editar fundo</Button>
            <Button onClick={() => setOpen((value) => !value)}>{open ? 'Recolher' : 'Expandir'} camadas da timeline</Button>
          </ActionMenu>
          {expand}
        </div>
      </div>
      {open && (
        <>
          <div className="timeline-scroll" ref={scroll} aria-label="Faixas da composição">
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
                    onContextMenu={(event) => onContextMenu(event, track.id)}
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
        </>
      )}
    </section>
  );
}
