import { Play } from 'lucide-react';
import type { MediaItem } from '../domain/models';
import { compositionDuration, imageFrameTime } from '../domain/timeline';
import { IconButton } from './Primitives';
import { NumberCommit } from './NumberCommit';
export function ImageTimeline({
  item,
  time,
  playing,
  onTime,
  onPlay,
  onChange,
}: {
  item: MediaItem;
  time: number;
  playing: boolean;
  onTime: (time: number) => void;
  onPlay: () => void;
  onChange: (item: MediaItem) => void;
}) {
  const duration = compositionDuration(item);
  const commit = () => {
    if (Math.abs(time - imageFrameTime(item)) > 0.0001) onChange({ ...item, imageTime: Math.min(duration - 0.001, Math.max(0, time)) });
  };
  return (
    <section className="image-timeline" aria-label="Composição da imagem">
      <div className="row-between">
        <div className="row">
          <IconButton label={playing ? 'Pausar composição' : 'Reproduzir composição'} onClick={onPlay}>
            {playing ? 'Ⅱ' : <Play size={15} />}
          </IconButton>
          <strong>Quadro da imagem</strong>
          <span className="mono">{time.toFixed(2)}s</span>
        </div>
        <small>A saída continua PNG, JPG ou WebP.</small>
      </div>
      <input
        type="range"
        aria-label="Quadro da imagem"
        min={0}
        max={Math.max(0, duration - 0.001)}
        step={0.01}
        value={Math.min(time, duration - 0.001)}
        onChange={(event) => onTime(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <div className="timeline-time-fields">
        <NumberCommit
          label="Momento da imagem exportada (s)"
          value={imageFrameTime(item)}
          max={duration - 0.001}
          step={0.01}
          onCommit={(imageTime) => {
            onTime(imageTime);
            onChange({ ...item, imageTime });
          }}
        />
        <NumberCommit
          label="Duração da composição (s)"
          value={duration}
          min={0.1}
          onCommit={(imageDuration) =>
            onChange({ ...item, imageDuration, imageTime: Math.min(imageFrameTime(item), imageDuration - 0.001) })
          }
        />
      </div>
    </section>
  );
}
