import { ChevronDown, ChevronUp, RotateCcw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { MediaItem, Profile } from '../domain/models';
import { BACKGROUND_TRACK, compositionDuration, patchTrack, removeTrack, timelineTracks, trackRange, type Track } from '../domain/timeline';
import { IconButton, Toggle } from './Primitives';
import { NumberCommit } from './NumberCommit';
import { TimelineTrack } from './TimelineTrack';
export function LayerTimeline({
  item,
  profile,
  time,
  selectedId,
  onSelect,
  onChange,
  onTime,
}: {
  item: MediaItem;
  profile: Profile;
  time: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (item: MediaItem) => void;
  onTime: (time: number) => void;
}) {
  const [open, setOpen] = useState(true),
    duration = compositionDuration(item),
    tracks = timelineTracks(item, profile);
  const latest = useRef(item);
  latest.current = item;
  const step = Math.min(1 / (item.probe?.fps || 30), duration / 2),
    selected = tracks.find((track) => track.id === selectedId),
    outputTime = item.kind === 'video' ? (time - item.trim.in) / item.speed : time;
  const patch = (id: string, change: Parameters<typeof patchTrack>[2]) => onChange(patchTrack(latest.current, id, change));
  const seek = (seconds: number) => onTime(item.kind === 'video' ? item.trim.in + seconds * item.speed : seconds);
  const select = (track: Track) => {
    onSelect(track.id);
    const range = trackRange(track, duration);
    if (outputTime < range.start || outputTime >= range.end) seek(Math.min(duration - step, range.start));
  };
  return (
    <section className="layer-timeline" aria-label="Timeline das camadas">
      <div className="row-between">
        <div className="row">
          <IconButton label={open ? 'Recolher camadas da timeline' : 'Expandir camadas da timeline'} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </IconButton>
          <h3>Camadas ({tracks.length})</h3>
        </div>
        <small>Tempos na saída · arraste pontas ou a faixa</small>
      </div>
      {open && (
        <>
          <div
            className="layer-time-ruler"
            role="slider"
            tabIndex={0}
            aria-label="Cursor das camadas"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Math.max(0, outputTime)}
            onPointerDown={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              seek(Math.min(duration - step, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * duration)));
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                seek(Math.max(0, Math.min(duration - step, outputTime + (event.key === 'ArrowRight' ? step : -step))));
              }
            }}
          >
            <span>0s</span>
            <span>{(duration / 2).toFixed(1)}s</span>
            <span>{duration.toFixed(2)}s</span>
          </div>
          <div className="timeline-track-list">
            {tracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                duration={duration}
                step={step}
                time={outputTime}
                selected={track.id === selectedId}
                onSelect={() => select(track)}
                onVisible={() => patch(track.id, { visible: track.visible === false })}
                onCommit={(enable) => patch(track.id, { enable })}
              />
            ))}
          </div>
          {selected && (
            <div className="timeline-inspector" aria-label={`Tempos de ${selected.name}`}>
              <strong className="truncate">{selected.name}</strong>
              <div className="timeline-time-fields">
                <NumberCommit
                  label="Aparecer em (s)"
                  value={trackRange(selected, duration).start}
                  max={Math.max(0, Math.min(duration, trackRange(selected, duration).end) - step)}
                  step={step}
                  onCommit={(start) =>
                    patch(selected.id, { enable: { start, end: Math.min(duration, trackRange(selected, duration).end) } })
                  }
                />
                <NumberCommit
                  label="Desaparecer em (s)"
                  value={trackRange(selected, duration).end}
                  min={Math.max(0, Math.min(duration - step, trackRange(selected, duration).start)) + step}
                  max={duration}
                  step={step}
                  onCommit={(end) =>
                    patch(selected.id, { enable: { start: Math.max(0, Math.min(trackRange(selected, duration).start, end - step)), end } })
                  }
                />
                <IconButton label="Usar durante todo o trecho" onClick={() => patch(selected.id, { enable: undefined })}>
                  <RotateCcw size={14} />
                </IconButton>
                <IconButton
                  label={selected.id === BACKGROUND_TRACK ? 'Restaurar fundo sólido' : 'Remover camada da timeline'}
                  onClick={() => onChange(removeTrack(item, selected.id))}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
              {selected.type === 'video' && (
                <div className="timeline-video-options">
                  <NumberCommit
                    label="Começar no segundo do template"
                    value={selected.sourceOffset || 0}
                    max={selected.sourceDuration ? Math.max(0, selected.sourceDuration - 0.001) : 86400}
                    onCommit={(sourceOffset) => patch(selected.id, { sourceOffset })}
                  />
                  <Toggle
                    label="Repetir vídeo na camada"
                    checked={selected.loop !== false}
                    onChange={(loop) => patch(selected.id, { loop })}
                  />
                </div>
              )}
            </div>
          )}
          {!selected && <small>Selecione uma faixa para editar os segundos exatos. Fundo, templates e textos têm faixas próprias.</small>}
        </>
      )}
    </section>
  );
}
