import { useEffect, useState } from 'react';
import { duplicateMedia, renumberMedia, splitMedia } from '../domain/editing';
import type { MediaItem } from '../domain/models';
import { chooseMediaFiles } from '../services/native';
import type { WorkspaceStore } from './Dashboard';
import type { MediaMenu } from './MediaContextMenu';
export function useClipActions({
  store,
  active,
  selected,
  items,
  time,
  notify,
  exportOne,
}: {
  store: WorkspaceStore;
  active: MediaItem | null;
  selected: MediaItem[];
  items: MediaItem[];
  time: number;
  notify: (message: string) => void;
  exportOne: (id: string) => void;
}) {
  const [menu, setMenu] = useState<MediaMenu | null>(null),
    [copy, setCopy] = useState<{ source: MediaItem; ids: string[]; sequence?: boolean } | null>(null),
    [compare, setCompare] = useState(false);
  const action = (command: string, item: MediaItem) => {
    try {
      if (command === 'export') exportOne(item.id);
      if (command === 'copy-all' || command === 'copy-selected')
        setCopy({
          source: structuredClone(item),
          ids: (command === 'copy-all' ? items : selected)
            .filter((value) => value.id !== item.id && value.status !== 'empty')
            .map((value) => value.id),
        });
      if (command === 'duplicate' || command === 'split')
        store.updateProject((project) => ({
          ...project,
          items: renumberMedia(
            project.items.flatMap((value) =>
              value.id !== item.id ? [value] : command === 'split' ? splitMedia(value, time) : [value, duplicateMedia(value)],
            ),
          ),
        }));
      if (command === 'remove') {
        store.updateProject((project) => ({ ...project, items: renumberMedia(project.items.filter((value) => value.id !== item.id)) }));
        notify('Mídia removida do projeto. O original foi preservado; Ctrl + Z desfaz.');
      }
      if (command === 'relink')
        void chooseMediaFiles()
          .then((files) => (files[0] ? store.relinkItem(item.id, files[0]) : undefined))
          .catch((error) => notify(String(error)));
    } catch (error) {
      notify(String(error));
    }
  };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        !active ||
        event.repeat ||
        (event.target instanceof HTMLElement &&
          event.target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]'))
      )
        return;
      const command =
        event.key === 'Delete'
          ? 'remove'
          : !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 's'
            ? 'split'
            : (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd'
              ? 'duplicate'
              : '';
      if (command) {
        event.preventDefault();
        action(command, active);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });
  return {
    menu,
    setMenu,
    clipAction: action,
    copy,
    setCopy,
    compare,
    setCompare,
    split: () => {
      if (active) action('split', active);
    },
  };
}
