import type { KeyboardEvent } from 'react';
import {
  BACKGROUND_TRACK,
  MEDIA_TRACK,
  compositionDuration,
  makeIntro,
  outputTime,
  patchTrack,
  removeTrack,
  reorderTrack,
  timelineTracks,
  trackRange,
} from '../domain/timeline';
import { splitLayer } from '../domain/sequence';
import type { EditorContext } from './useEditor';
export function selectEditorTrack(model: EditorContext, id: string) {
  model.setLayerId(id === MEDIA_TRACK ? null : id);
  model.setStep(3);
  model.setCropMode(false);
  model.setInspectorTab('basic');
}
export function trackOptions(model: EditorContext, id: string) {
  const item = model.active;
  if (!item) return [];
  const tracks = timelineTracks(item, model.profile),
    track = tracks.find((track) => track.id === id);
  if (!track) return [];
  const range = trackRange(track, compositionDuration(item)),
    at = outputTime(item, model.time),
    main = id === MEDIA_TRACK,
    bg = id === BACKGROUND_TRACK;
  const order = tracks.filter((track) => track.id !== BACKGROUND_TRACK),
    index = order.findIndex((track) => track.id === id);
  return [
    { id: 'timing', label: 'Editar tempos', disabled: false },
    ...(!main && !bg ? [{ id: 'intro', label: 'Usar como abertura', disabled: false }] : []),
    ...(!bg
      ? [
          {
            id: 'split',
            label: main ? 'Dividir mídia em dois slots' : 'Dividir camada no cursor',
            disabled: at <= range.start + 0.02 || at >= range.end - 0.02,
          },
          { id: 'duplicate', label: main ? 'Duplicar mídia' : 'Duplicar camada', disabled: false },
          { id: 'up', label: 'Subir camada', disabled: index <= 0 },
          { id: 'down', label: 'Descer camada', disabled: index < 0 || index === order.length - 1 },
        ]
      : []),
    ...(!main ? [{ id: 'full', label: 'Usar durante todo o trecho', disabled: false }] : []),
    {
      id: 'remove',
      label: main ? 'Remover mídia do projeto' : bg ? 'Restaurar fundo sólido' : 'Remover camada da timeline',
      disabled: false,
    },
  ];
}
export function runTrackCommand(model: EditorContext, id: string, command: string) {
  const item = model.active;
  if (!item) return;
  if (command === 'timing') {
    selectEditorTrack(model, id);
    model.setInspectorTab('timing');
    return;
  }
  if (command === 'intro') {
    model.changeItem(makeIntro(item, id));
    return;
  }
  if (command === 'remove') {
    if (id === MEDIA_TRACK) model.clipAction('remove', item);
    else {
      model.changeItem(removeTrack(item, id));
      model.setLayerId(null);
    }
    return;
  }
  if (command === 'full') {
    model.changeItem(patchTrack(item, id, { enable: undefined }));
    return;
  }
  if (command === 'up' || command === 'down') {
    const order = timelineTracks(item, model.profile).filter((track) => track.id !== BACKGROUND_TRACK),
      index = order.findIndex((track) => track.id === id),
      target = order[index + (command === 'up' ? -1 : 1)];
    if (index >= 0 && target) model.changeItem(reorderTrack(item, id, target.id));
    return;
  }
  if (id === MEDIA_TRACK) {
    model.clipAction(command, item);
    return;
  }
  if (command === 'split') {
    model.changeItem(splitLayer(item, id, outputTime(item, model.time)));
    return;
  }
  const layer = item.render.layers.find((layer) => layer.id === id);
  if (command === 'duplicate' && layer) {
    const key = `${id.split(':copy:')[0].split(':part:')[0]}:copy:${crypto.randomUUID()}`;
    model.changeItem({
      ...item,
      render: { ...item.render, layers: [...item.render.layers, { ...structuredClone(layer), id: key, zIndex: layer.zIndex + 1 }] },
    });
    selectEditorTrack(model, key);
  }
}

export function handleTrackShortcut(event: KeyboardEvent, model: EditorContext) {
  if ((event.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"],[role="dialog"],[role="menu"]')) return;
  const command =
    event.key === 'Delete'
      ? 'remove'
      : (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd'
        ? 'duplicate'
        : !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 's'
          ? 'split'
          : null;
  if (!command) return;
  event.preventDefault();
  event.stopPropagation();
  const id = model.layerId || MEDIA_TRACK;
  if (!event.repeat && trackOptions(model, id).some((option) => option.id === command && !option.disabled))
    runTrackCommand(model, id, command);
}
