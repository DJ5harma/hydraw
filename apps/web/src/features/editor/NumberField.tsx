import { useEffect, useId, useState } from "react";

/** Keep incomplete numeric drafts out of editor commands and report rejected commits locally. */
export function NumberField({
  label,
  name,
  min,
  max,
  value,
  onCommit,
  className,
}: {
  label: string;
  name: string;
  min: number;
  max: number;
  value: number;
  onCommit: (value: number) => void;
  className: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  useEffect(() => {
    setDraft(String(value));
    setError(null);
  }, [value]);
  function commit() {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || number < min || number > max) {
      setError(`Use ${min.toLocaleString()} to ${max.toLocaleString()}.`);
      return;
    }
    try {
      onCommit(number);
      setDraft(String(number));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This value could not be applied.");
    }
  }
  return (
    <label className={className}>
      <span>{label}</span>
      <input
        type="number"
        aria-label={name}
        min={min}
        max={max}
        step="any"
        value={draft}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(String(value));
            setError(null);
          }
        }}
      />
      {error && (
        <small id={errorId} className="number-field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
