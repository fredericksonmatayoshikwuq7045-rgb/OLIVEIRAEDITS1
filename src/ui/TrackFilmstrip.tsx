import { useEffect, useState } from 'react';
import type { MediaItem, Profile } from '../domain/models';
import type { Track } from '../domain/timeline';
import { MEDIA_TRACK } from '../domain/timeline';
import { sampleFrames } from '../services/filmstrip';
import { mediaUrl } from '../services/backend';
export function TrackFilmstrip({ track, item, profile }: { track: Track; item: MediaItem; profile: Profile }) {
  const [frames, setFrames] = useState<string[]>([]);
  const source = track.source;
  useEffect(() => {
    let disposed = false;
    setFrames([]);
    if (!source || track.type === 'text') return;
    if (track.type !== 'video') {
      setFrames([mediaUrl(source)]);
      return;
    }
    const asset = profile.assets.find((asset) => asset.source === source || asset.runtimeUrl === source);
    const template = profile.templates.find((template) => template.source === source || template.runtimeUrl === source);
    const media =
      track.id === MEDIA_TRACK
        ? item
        : {
            ...item,
            kind: 'video' as const,
            sourcePath: asset?.source || template?.source || source,
            runtimeUrl: source,
            render: { ...item.render, media: { ...item.render.media, source } },
            probe: undefined,
            trim: { in: 0, out: track.sourceDuration || 5 },
          };
    void sampleFrames(media, profile, 4, true, 160)
      .then((frames) => {
        if (!disposed) setFrames(frames.map((frame) => frame.url));
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
    // Only decode when the underlying clip/trim changes, never for a playhead or drag update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, item.id, item.trim.in, item.trim.out, track.type, track.sourceDuration]);
  return (
    <div className="track-filmstrip" aria-hidden="true">
      {frames.map((url, index) => (
        <img key={index} src={url} alt="" draggable={false} />
      ))}
    </div>
  );
}
