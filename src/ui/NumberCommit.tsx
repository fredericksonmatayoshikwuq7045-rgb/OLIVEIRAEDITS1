import { useEffect, useRef, useState } from 'react';
/** Keep incomplete numeric typing out of the project and commit one undoable edit. */
export function NumberCommit({
  label,
  value,
  min = 0,
  max = 86400,
  step = 0.1,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  const cancel = useRef(false);
  useEffect(() => {
    setDraft(String(Number(value.toFixed(3))));
  }, [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            cancel.current = true;
            setDraft(String(Number(value.toFixed(3))));
            event.currentTarget.blur();
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onBlur={() => {
          if (cancel.current) {
            cancel.current = false;
            return;
          }
          const next = draft.trim() && Number(draft);
          if (typeof next === 'number' && Number.isFinite(next)) {
            const bounded = Math.max(min, Math.min(max, next));
            setDraft(String(Number(bounded.toFixed(3))));
            if (Math.abs(bounded - value) > 0.00001) onCommit(bounded);
          } else setDraft(String(Number(value.toFixed(3))));
        }}
      />
    </label>
  );
}
