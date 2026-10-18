import { useRef } from 'react';
export function PanelResize({
  label,
  value,
  onChange,
  reverse = false,
  target,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  reverse?: boolean;
  target?: string;
}) {
  const start = useRef<{ x: number; value: number } | null>(null);
  const displayedWidth = (element: HTMLElement) =>
    (target
      ? element.parentElement?.querySelector(target)
      : reverse
        ? element.nextElementSibling
        : element.previousElementSibling
    )?.getBoundingClientRect().width ?? value;
  return (
    <div
      className="panel-resize"
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={value}
      onPointerDown={(event) => {
        start.current = { x: event.clientX, value: displayedWidth(event.currentTarget) };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current) onChange(start.current.value + (event.clientX - start.current.x) * (reverse ? -1 : 1));
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          onChange(displayedWidth(event.currentTarget) + (event.key === 'ArrowRight' ? 10 : -10) * (reverse ? -1 : 1));
        }
      }}
    />
  );
}
