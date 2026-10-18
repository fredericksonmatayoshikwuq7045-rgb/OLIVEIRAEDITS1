import { ArrowDown, ArrowUp, Copy, RotateCcw, Scissors, Trash2 } from 'lucide-react';
import type { MediaItem, Profile } from '../domain/models';
import {
  BACKGROUND_TRACK,
  MEDIA_TRACK,
  MAX_TIME,
  compositionDuration,
  editTrackRange,
  mainRange,
  patchTrack,
  removeTrack,
  reorderTrack,
  timelineTracks,
  trackRange,
  makeIntro,
  type Track,
} from '../domain/timeline';
import { NumberCommit } from './NumberCommit';
import { Button, IconButton, Toggle } from './Primitives';
import { TrackGeometry } from './TrackGeometry';
import { splitLayer } from '../domain/sequence';
export function TrackInspector({
  item,
  profile,
  selected,
  time,
  onChange,
  onSelect,
}: {
  item: MediaItem;
  profile: Profile;
  selected: Track;
  time: number;
  onChange: (item: MediaItem) => void;
  onSelect: (id: string) => void;
}) {
  const duration = compositionDuration(item),
    range = trackRange(selected, duration),
    step = 1 / (item.probe?.fps || 30);
  const main = selected.id === MEDIA_TRACK,
    background = selected.id === BACKGROUND_TRACK;
  const patch = (change: Parameters<typeof patchTrack>[2]) => onChange(patchTrack(item, selected.id, change));
  const update = (start: number, end: number, edge: string) => onChange(editTrackRange(item, selected.id, { start, end }, edge));
  const order = timelineTracks(item, profile).filter((track) => track.id !== BACKGROUND_TRACK),
    index = order.findIndex((track) => track.id === selected.id);
  return (
    <div className="timeline-inspector" aria-label={`Tempos de ${selected.name}`}>
      <div className="row-between">
        <strong className="truncate">{selected.name}</strong>
        <div className="row">
          {!background && (
            <>
              <IconButton
                label="Subir camada"
                disabled={index <= 0}
                onClick={() => onChange(reorderTrack(item, selected.id, order[index - 1].id))}
              >
                <ArrowUp size={14} />
              </IconButton>
              <IconButton
                label="Descer camada"
                disabled={index < 0 || index === order.length - 1}
                onClick={() => onChange(reorderTrack(item, selected.id, order[index + 1].id))}
              >
                <ArrowDown size={14} />
              </IconButton>
            </>
          )}
          {!main && (
            <IconButton label="Usar durante todo o trecho" onClick={() => patch({ enable: undefined })}>
              <RotateCcw size={14} />
            </IconButton>
          )}
          {!main && (
            <IconButton
              label={background ? 'Restaurar fundo sólido' : 'Remover camada da timeline'}
              onClick={() => onChange(removeTrack(item, selected.id))}
            >
              <Trash2 size={14} />
            </IconButton>
          )}
        </div>
      </div>
      <div className="timeline-time-fields">
        <NumberCommit
          label="Aparecer em (s)"
          value={range.start}
          max={MAX_TIME - (range.end - range.start)}
          step={step}
          onCommit={(start) => update(start, main ? start + (range.end - range.start) : Math.max(range.end, start + step), 'move')}
        />
        <NumberCommit
          label="Desaparecer em (s)"
          value={range.end}
          min={range.start + step}
          max={MAX_TIME}
          step={step}
          onCommit={(end) => update(range.start, end, 'end')}
        />
        <NumberCommit
          label="Duração da camada (s)"
          value={range.end - range.start}
          min={step}
          max={MAX_TIME - range.start}
          step={step}
          onCommit={(span) => update(range.start, range.start + span, 'end')}
        />
      </div>
      {main && (
        <small>
          Arraste o clipe para entrar depois da abertura. As pontas aparam o arquivo original; a composição inclui todas as camadas.
        </small>
      )}
      {main && item.kind === 'video' && (
        <Toggle
          label="Áudio do vídeo principal"
          checked={item.render.media.audio !== 'mute'}
          onChange={(audio) => patch({ audio: audio ? 'mix' : 'mute' })}
        />
      )}
      {selected.type === 'video' && !main && (
        <div className="timeline-video-options">
          <NumberCommit
            label="Começar no segundo do template"
            value={selected.sourceOffset || 0}
            max={selected.sourceDuration ? Math.max(0, selected.sourceDuration - 0.001) : MAX_TIME}
            onCommit={(sourceOffset) => patch({ sourceOffset })}
          />
          <Toggle label="Repetir vídeo na camada" checked={selected.loop !== false} onChange={(loop) => patch({ loop })} />
          <Toggle
            label="Áudio do vídeo nesta camada"
            checked={selected.audio === 'mix'}
            onChange={(audio) => patch({ audio: audio ? 'mix' : 'mute' })}
          />
        </div>
      )}
      {!main && !background && (
        <div className="row timeline-actions">
          <Button onClick={() => onChange(makeIntro(item, selected.id))}>Usar como abertura</Button>
          <Button
            onClick={() => {
              const layer = item.render.layers.find((layer) => layer.id === selected.id)!;
              const id = `${layer.id.split(':copy:')[0].split(':part:')[0]}:copy:${crypto.randomUUID()}`;
              onChange({
                ...item,
                render: { ...item.render, layers: [...item.render.layers, { ...structuredClone(layer), id, zIndex: layer.zIndex + 1 }] },
              });
              onSelect(id);
            }}
          >
            <Copy size={13} /> Duplicar camada
          </Button>
          <Button
            disabled={time <= range.start + step || time >= range.end - step}
            onClick={() => onChange(splitLayer(item, selected.id, time))}
          >
            <Scissors size={13} /> Dividir camada no cursor
          </Button>
          <small>A mídia principal entra em {mainRange(item).start.toFixed(2)}s.</small>
        </div>
      )}
      <TrackGeometry item={item} id={selected.id} onChange={onChange} />
    </div>
  );
}
