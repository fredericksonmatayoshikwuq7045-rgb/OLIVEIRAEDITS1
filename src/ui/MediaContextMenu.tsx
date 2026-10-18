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
}: {
  menu: MediaMenu;
  onClose: () => void;
  onAction: (action: string, item: MediaItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const node = ref.current;
    node?.querySelector('button')?.focus();
    const close = (event: PointerEvent) => {
      if (!node?.contains(event.target as Node)) closeRef.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...(node?.querySelectorAll('button') || [])];
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
  return (
    <div
      ref={ref}
      className="media-context-menu"
      role="menu"
      aria-label={`Ações de ${menu.item.title}`}
      style={{ left: Math.max(8, Math.min(menu.x, window.innerWidth - 260)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 275)) }}
    >
      {(
        [
          ['export', 'Exportar esta mídia'],
          ['duplicate', 'Duplicar'],
          ['copy-all', 'Aplicar edição a todos…'],
          ['copy-selected', 'Aplicar à seleção…'],
          ['relink', 'Revincular arquivo'],
          ['remove', 'Remover do projeto'],
        ] as const
      ).map(([action, label]) => (
        <button
          role="menuitem"
          key={action}
          className={action === 'remove' ? 'danger-text' : ''}
          onClick={() => {
            onAction(action, menu.item);
            onClose();
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
