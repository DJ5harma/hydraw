import { useRef, useState } from "react";

/** Keep a slider gesture local and commit once, so dragging creates one undo step. */
export function RangeField({
  label,
  name,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onCommit,
}: {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const current = draft ?? value;
  function commit() {
    const next = pending.current;
    pending.current = null;
    setDraft(null);
    if (next !== null && next !== value) onCommit(next);
  }
  return (
    <label className="range-field">
      <span>
        {label}
        <span className="range-value" aria-hidden="true">
          {current}
          {unit}
        </span>
      </span>
      <input
        type="range"
        aria-label={name}
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) => {
          pending.current = Number(event.target.value);
          setDraft(pending.current);
        }}
        onPointerUp={commit}
        onBlur={commit}
        onKeyUp={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            pending.current = null;
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        onPointerCancel={() => {
          pending.current = null;
          setDraft(null);
        }}
      />
    </label>
  );
}
