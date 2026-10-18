import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
/** Small contextual popover; escapes clipped panels and returns focus on Escape. */
export function ActionMenu({ label, children, icon, text }: { label: string; children: ReactNode; icon?: ReactNode; text?: string }) {
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!position) return;
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setPosition(null);
        trigger.current?.focus();
      }
      if (
        (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        panel.current?.contains(document.activeElement) &&
        document.activeElement?.tagName === 'BUTTON'
      ) {
        const nodes = [...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),select,input')];
        const index = nodes.indexOf(document.activeElement as HTMLElement);
        if (nodes.length) {
          event.preventDefault();
          nodes[(index + (event.key === 'ArrowDown' ? 1 : nodes.length - 1)) % nodes.length]?.focus();
        }
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    const close = () => setPosition(null);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', close);
    };
  }, [position]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`action-trigger ${text ? 'action-trigger-text' : ''}`}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={!!position}
        onClick={() => {
          if (position) {
            setPosition(null);
            return;
          }
          const box = trigger.current!.getBoundingClientRect();
          setPosition({
            left: Math.max(8, Math.min(window.innerWidth - 252, box.right - 240)),
            top: Math.min(window.innerHeight - 160, box.bottom + 6),
          });
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            trigger.current?.click();
            requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button:not(:disabled),select')?.focus());
          }
        }}
      >
        {icon || <MoreHorizontal size={16} />} {text}
      </button>
      {position &&
        createPortal(
          <div
            ref={panel}
            className="action-popover"
            role="dialog"
            aria-label={label}
            style={{ ...position, maxHeight: `${window.innerHeight - position.top - 12}px` }}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('button')) setPosition(null);
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
