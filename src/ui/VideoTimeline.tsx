import { Play, Scissors } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MediaItem, Profile } from '../domain/models';
import { sampleFrames, type SampleFrame } from '../services/filmstrip';
import { Button, IconButton, timecode } from './Primitives';
import { compositionDuration, outputTime, playerTime } from '../domain/timeline';
export function VideoTimeline({
  item,
  profile,
  time,
  playing,
  onTime,
  onPlay,
  onChange,
  onSplit,
  performance = false,
}: {
  item: MediaItem;
  profile: Profile;
  time: number;
  playing: boolean;
  onTime: (time: number) => void;
  onPlay: () => void;
  onChange: (item: MediaItem) => void;
  onSplit: () => void;
  performance?: boolean;
}) {
  const [frames, setFrames] = useState<SampleFrame[]>([]),
    [trim, setTrim] = useState(item.trim),
    [error, setError] = useState('');
  const source = item.runtimeUrl || item.sourcePath,
    duration = item.probe?.duration || item.trim.out,
    step = 1 / (item.probe?.fps || 30);
  useEffect(() => {
    setTrim(item.trim);
  }, [item.trim]);
  useEffect(() => {
    let disposed = false;
    setFrames([]);
    setError('');
    if (!performance)
      void sampleFrames(item, profile)
        .then((value) => {
          if (!disposed) setFrames(value);
        })
        .catch(() => {
          if (!disposed) setError('Miniaturas indisponíveis; corte e reprodução continuam disponíveis.');
        });
    return () => {
      disposed = true;
    };
    // Frames depend on the source, not on each editing gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, duration, performance]);
  const update = (edge: 'in' | 'out', value: number) => {
    const next =
      edge === 'in'
        ? { ...trim, in: Math.max(0, Math.min(value, trim.out - step)) }
        : { ...trim, out: Math.min(duration, Math.max(value, trim.in + step)) };
    setTrim(next);
    onTime(edge === 'in' ? next.in : Math.max(next.in, next.out - step));
    return next;
  };
  const commit = () => {
    if (trim.in !== item.trim.in || trim.out !== item.trim.out) onChange({ ...item, trim });
  };
  return (
    <section className="video-timeline" aria-label="Timeline do vídeo">
      <div className="row-between">
        <div className="row">
          <IconButton label={playing ? 'Pausar prévia' : 'Reproduzir prévia'} onClick={onPlay}>
            {playing ? 'Ⅱ' : <Play size={16} />}
          </IconButton>
          <span className="mono">
            {timecode(Math.max(0, outputTime(item, time)))} / {timecode(compositionDuration(item))}
          </span>
        </div>
        <Button disabled={time <= item.trim.in + step / 2 || time >= item.trim.out - step / 2} onClick={onSplit}>
          <Scissors size={14} /> Dividir no cursor (S)
        </Button>
      </div>
      <input
        aria-label="Posição na composição"
        type="range"
        min={0}
        max={compositionDuration(item) - 0.001}
        step={step / item.speed}
        value={Math.max(0, outputTime(item, time))}
        onChange={(event) => onTime(playerTime(item, Number(event.target.value)))}
      />
      <details className="source-trim">
        <summary>Aparar arquivo original · {((trim.out - trim.in) / item.speed).toFixed(2)}s</summary>
        <div
          className="filmstrip"
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget && !(event.target as HTMLElement).closest('.filmstrip-frames')) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            onTime(Math.max(trim.in, Math.min(trim.out, ((event.clientX - bounds.left) / bounds.width) * duration)));
          }}
        >
          <div className="filmstrip-frames">
            {frames.map((frame) => (
              <img key={frame.time} src={frame.url} alt="" draggable={false} />
            ))}
          </div>
          <div className="trim-shade" style={{ left: 0, width: `${(trim.in / duration) * 100}%` }} />
          <div className="trim-shade" style={{ left: `${(trim.out / duration) * 100}%`, right: 0 }} />
          <div
            className="trim-selection"
            style={{ left: `${(trim.in / duration) * 100}%`, width: `${((trim.out - trim.in) / duration) * 100}%` }}
          />
          {(['in', 'out'] as const).map((edge) => (
            <input
              key={edge}
              className={`trim-range trim-${edge}`}
              aria-label={edge === 'in' ? 'Arrastar início do corte' : 'Arrastar fim do corte'}
              type="range"
              min={0}
              max={duration}
              step={step}
              value={trim[edge]}
              onChange={(event) => update(edge, Number(event.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={() => {
                if (trim.in !== item.trim.in || trim.out !== item.trim.out) onChange({ ...item, trim });
              }}
            />
          ))}
          <div className="timeline-cursor" style={{ left: `${(time / duration) * 100}%` }} />
        </div>
        <input
          aria-label="Posição de reprodução"
          type="range"
          min={trim.in}
          max={trim.out}
          step={step}
          value={Math.min(trim.out, Math.max(trim.in, time))}
          onChange={(event) => onTime(Number(event.target.value))}
        />
        <div className="timeline-trims">
          {(['in', 'out'] as const).map((edge) => (
            <label key={edge}>
              {edge === 'in' ? 'De' : 'até'}{' '}
              <input
                aria-label={edge === 'in' ? 'Início do corte' : 'Fim do corte'}
                type="number"
                min={edge === 'in' ? 0 : trim.in + step}
                max={edge === 'in' ? trim.out - step : duration}
                step={0.1}
                value={trim[edge]}
                onChange={(event) => onChange({ ...item, trim: update(edge, Number(event.target.value)) })}
              />
            </label>
          ))}
          <small>
            {item.speed}× · {item.probe?.fps.toFixed(2) || '—'} fps
          </small>
        </div>
        {error && <small className="muted">{error}</small>}
      </details>
    </section>
  );
}
