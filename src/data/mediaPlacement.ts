import type { MediaItem } from '../domain/models';

/** Assign slots against the latest project, after asynchronous probing finishes. */
export function placeImportedMedia(previous: MediaItem[], imported: MediaItem[]): MediaItem[] {
  const items = [...previous];
  const occupied = new Set(previous.filter((item) => item.status !== 'empty').map((item) => item.slot));
  let slot = 1;
  for (const item of imported) {
    while (occupied.has(slot)) slot++;
    const emptyIndex = items.findIndex((value) => value.slot === slot && value.status === 'empty');
    const placed = { ...item, slot };
    if (emptyIndex >= 0) {
      placed.id = items[emptyIndex].id;
      placed.legacyPayload = items[emptyIndex].legacyPayload;
      items[emptyIndex] = placed;
    } else items.push(placed);
    occupied.add(slot);
  }
  return items.sort((a, b) => a.slot - b.slot);
}

/** Replace the source while retaining the item's identity and current edits. */
export function relinkMedia(item: MediaItem, replacement: MediaItem): MediaItem {
  if (item.kind !== replacement.kind) throw new Error('Selecione uma mídia do mesmo tipo do item original.');
  const duration = replacement.probe?.duration ?? 0;
  const out = item.kind === 'video' ? Math.min(item.trim.out > 0 ? item.trim.out : duration, duration) : 0;
  const start = Number.isFinite(item.trim.in) ? Math.max(0, item.trim.in) : 0;
  return {
    ...item,
    title: replacement.title,
    sourcePath: replacement.sourcePath,
    assetId: replacement.assetId,
    runtimeUrl: replacement.runtimeUrl,
    thumbnailUrl: replacement.thumbnailUrl,
    probe: replacement.probe,
    status: 'ready',
    error: undefined,
    render: {
      ...item.render,
      media: {
        ...item.render.media,
        source: replacement.render.media.source,
        width: replacement.render.media.width,
        height: replacement.render.media.height,
      },
    },
    trim: { in: start < out ? start : 0, out },
  };
}
