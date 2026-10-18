import { useEffect, useState } from 'react';
import type { MediaItem } from '../domain/models';
import { compositionDuration, imageFrameTime } from '../domain/timeline';
export function usePlayback(active: MediaItem | null, onChange: (item: MediaItem) => void) {
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0);
  const initialTime = active ? (active.kind === 'image' ? imageFrameTime(active) : active.trim.in) : 0;
  useEffect(() => {
    setPlaying(false);
    setTime(initialTime);
  }, [active?.id, initialTime]);
  const freezeImage = (value = time) => {
    if (active?.kind !== 'image') return;
    const imageTime = Math.max(0, Math.min(compositionDuration(active) - 0.001, value));
    if (Math.abs(imageFrameTime(active) - imageTime) > 0.00001) onChange({ ...active, imageTime });
  };
  const playTime = (seconds: number) => {
    if (!active) return;
    const end = active.kind === 'video' ? active.trim.out : compositionDuration(active);
    if (seconds >= end) {
      setPlaying(false);
      if (active.kind === 'image') {
        setTime(end - 0.001);
        freezeImage(end - 0.001);
      } else setTime(active.trim.in);
    } else setTime(seconds);
  };
  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      freezeImage();
    } else {
      if (active && time >= (active.kind === 'video' ? active.trim.out : compositionDuration(active)) - 0.02)
        setTime(active.kind === 'video' ? active.trim.in : 0);
      setPlaying(true);
    }
  };
  return { time, setTime, playing, setPlaying, playTime, togglePlayback, freezeImage };
}
