import type { MediaItem } from '../domain/models';
import { compositionDuration, imageFrameTime } from '../domain/timeline';
import { NumberCommit } from './NumberCommit';
import { Section } from './Primitives';
export function ImageTimeline({
  item,
  onTime,
  onChange,
}: {
  item: MediaItem;
  onTime: (time: number) => void;
  onChange: (item: MediaItem) => void;
}) {
  return (
    <Section title="Quadro exportado">
      <NumberCommit
        label="Momento da imagem exportada (s)"
        value={imageFrameTime(item)}
        max={compositionDuration(item) - 0.001}
        step={0.01}
        onCommit={(imageTime) => {
          onTime(imageTime);
          onChange({ ...item, imageTime });
        }}
      />
      <p className="tiny muted">A imagem exporta este quadro em PNG, JPG ou WebP.</p>
    </Section>
  );
}
