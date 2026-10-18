import { useEffect, useRef } from 'react';
import type { MediaItem } from '../domain/models';
export interface MediaMenu {
  x: number;
  y: number;
  item: MediaItem;
}
export function MediaContextMenu({
  menu,
  onClose,
  onAction,
  entries,
  title,
}: {
  menu: MediaMenu;
  onClose: () => void;
  onAction: (action: string, item: MediaItem) => void;
  entries?: { id: string; label: string; disabled?: boolean }[];
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const node = ref.current;
    node?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const close = (event: PointerEvent) => {
      if (!node?.contains(event.target as Node)) closeRef.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...(node?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? buttons.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons[next]?.focus();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    const resized = () => closeRef.current();
    window.addEventListener('resize', resized);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', resized);
    };
  }, []);
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 275));
  return (
    <div
      ref={ref}
      className="media-context-menu"
      role="menu"
      aria-label={title || `Ações de ${menu.item.title}`}
      style={{
        left: Math.max(8, Math.min(menu.x, window.innerWidth - 260)),
        top,
        maxHeight: window.innerHeight - top - 8,
        overflowY: 'auto',
      }}
    >
      {(
        entries || [
          { id: 'export', label: 'Exportar esta mídia' },
          { id: 'duplicate', label: 'Duplicar' },
          { id: 'copy-all', label: 'Aplicar edição a todos…' },
          { id: 'copy-selected', label: 'Aplicar à seleção…' },
          { id: 'relink', label: 'Revincular arquivo' },
          { id: 'remove', label: 'Remover do projeto' },
        ]
      ).map(({ id, label, disabled }) => (
        <button
          role="menuitem"
          key={id}
          disabled={disabled}
          className={id === 'remove' ? 'danger-text' : ''}
          onClick={() => {
            onAction(id, menu.item);
            onClose();
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
