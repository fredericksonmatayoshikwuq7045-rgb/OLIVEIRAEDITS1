import { useRef } from 'react';
export function PanelResize({
  label,
  value,
  onChange,
  reverse = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  reverse?: boolean;
}) {
  const start = useRef<{ x: number; value: number } | null>(null);
  return (
    <div
      className="panel-resize"
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={value}
      onPointerDown={(event) => {
        start.current = { x: event.clientX, value };
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
          onChange(value + (event.key === 'ArrowRight' ? 10 : -10) * (reverse ? -1 : 1));
        }
      }}
    />
  );
}
