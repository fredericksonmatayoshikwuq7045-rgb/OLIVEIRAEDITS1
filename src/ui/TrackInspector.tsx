import type { MediaItem, Profile } from '../domain/models';
import {
  BACKGROUND_TRACK,
  MEDIA_TRACK,
  MAX_TIME,
  compositionDuration,
  editTrackRange,
  makeIntro,
  patchTrack,
  trackRange,
  type Track,
} from '../domain/timeline';
import { NumberCommit } from './NumberCommit';
import { Button, Section, Toggle } from './Primitives';
export function TrackInspector({
  item,
  selected,
  onChange,
  mode = 'timing',
}: {
  item: MediaItem;
  profile?: Profile;
  selected: Track;
  time?: number;
  onChange: (item: MediaItem) => void;
  onSelect?: (id: string) => void;
  mode?: 'timing' | 'audio';
}) {
  const duration = compositionDuration(item),
    range = trackRange(selected, duration),
    step = 1 / (item.probe?.fps || 30),
    main = selected.id === MEDIA_TRACK;
  const patch = (change: Parameters<typeof patchTrack>[2]) => onChange(patchTrack(item, selected.id, change));
  const update = (start: number, end: number, edge: string) => onChange(editTrackRange(item, selected.id, { start, end }, edge));
  if (mode === 'audio')
    return (
      <div className="clip-inspector">
        <Section title="Áudio">
          <Toggle
            label={main ? 'Áudio do vídeo principal' : 'Áudio do vídeo nesta camada'}
            checked={main ? item.render.media.audio !== 'mute' : selected.audio === 'mix'}
            onChange={(audio) => patch({ audio: audio ? 'mix' : 'mute' })}
          />
          <p className="tiny muted">O áudio acompanha a entrada, o corte e a saída deste clipe.</p>
        </Section>
      </div>
    );
  return (
    <div className="clip-inspector" aria-label={`Tempos de ${selected.name}`}>
      <Section title="Posição no tempo">
        <div className="inspector-grid">
          <NumberCommit
            label="Aparecer em (s)"
            value={range.start}
            max={MAX_TIME - (range.end - range.start)}
            step={step}
            onCommit={(start) => update(start, main ? start + range.end - range.start : Math.max(range.end, start + step), 'move')}
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
        {!main && selected.id !== BACKGROUND_TRACK && (
          <Button onClick={() => onChange(makeIntro(item, selected.id))}>Usar como abertura</Button>
        )}
      </Section>
      <Section title="Ajuste preciso" defaultOpen={false}>
        <NumberCommit
          label="Desaparecer em (s)"
          value={range.end}
          min={range.start + step}
          max={MAX_TIME}
          step={step}
          onCommit={(end) => update(range.start, end, 'end')}
        />
        {selected.type === 'video' && !main && (
          <>
            <NumberCommit
              label="Começar no segundo do template"
              value={selected.sourceOffset || 0}
              max={selected.sourceDuration ? Math.max(0, selected.sourceDuration - 0.001) : MAX_TIME}
              onCommit={(sourceOffset) => patch({ sourceOffset })}
            />
            <Toggle label="Repetir vídeo na camada" checked={selected.loop !== false} onChange={(loop) => patch({ loop })} />
          </>
        )}
      </Section>
    </div>
  );
}
