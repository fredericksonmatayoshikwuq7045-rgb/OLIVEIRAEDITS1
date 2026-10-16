import { useRef, type PointerEvent } from 'react';
import type { MediaItem } from '../domain/models';

type Touch = { x: number; y: number };
export function usePinch(item: MediaItem | null, onDraft: (item: MediaItem) => void, onCommit: (item: MediaItem) => void) {
  const touches = useRef(new Map<number, Touch>());
  const gesture = useRef<{ distance: number; item: MediaItem; latest: MediaItem } | null>(null);
  const distance = () => {
    const [a, b] = Array.from(touches.current.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const start = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch' || !item) return false;
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.current.size < 2) return false;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { distance: Math.max(1, distance()), item, latest: item };
    return true;
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    if (!touches.current.has(event.pointerId)) return false;
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const state = gesture.current;
    if (!state) return false;
    if (touches.current.size < 2) return true;
    const media = state.item.render.media;
    state.latest = {
      ...state.item,
      render: { ...state.item.render, media: { ...media, zoom: Math.max(0.1, Math.min(5, (media.zoom * distance()) / state.distance)) } },
    };
    onDraft(state.latest);
    return true;
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    touches.current.delete(event.pointerId);
    const state = gesture.current;
    if (!state) return false;
    if (touches.current.size === 0) {
      gesture.current = null;
      onCommit(state.latest);
    }
    return true;
  };
  return { start, move, end };
}
