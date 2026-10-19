import { useEffect, useId, useState } from "react";
import { MAX_COORDINATE, MAX_SIZE } from "@hydraw/document";
import type { Shape } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";

const fields = [
  { key: "x", label: "X", min: -MAX_COORDINATE, max: MAX_COORDINATE },
  { key: "y", label: "Y", min: -MAX_COORDINATE, max: MAX_COORDINATE },
  { key: "width", label: "W", min: 1, max: MAX_SIZE },
  { key: "height", label: "H", min: 1, max: MAX_SIZE },
] as const;

export function GeometryFields({ shape, editor }: { shape: Shape; editor: Editor }) {
  return (
    <div className="geometry">
      {fields
        .filter((field) => shape.type !== "text" || field.key !== "height")
        .map(({ key, ...field }) => (
          <GeometryField
            key={key}
            {...field}
            name={`${shape.type === "text" ? "Text" : "Rectangle"} ${key}`}
            value={shape[key]}
            onCommit={(value) => editor.setGeometry({ [key]: value })}
          />
        ))}
    </div>
  );
}

function GeometryField({
  label,
  name,
  min,
  max,
  value,
  onCommit,
}: {
  label: string;
  name: string;
  min: number;
  max: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState(false);
  const errorId = useId();
  useEffect(() => {
    setDraft(String(value));
    setError(false);
  }, [value]);
  function commit() {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || number < min || number > max) {
      setError(true);
      return;
    }
    onCommit(number);
    setDraft(String(number));
    setError(false);
  }
  return (
    <label className="geometry-field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={name}
        min={min}
        max={max}
        step="any"
        value={draft}
        aria-invalid={error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            event.stopPropagation();
            setDraft(String(value));
            setError(false);
          }
        }}
      />
      {error && (
        <small id={errorId} role="alert">
          Use {min.toLocaleString()} to {max.toLocaleString()}.
        </small>
      )}
    </label>
  );
}
