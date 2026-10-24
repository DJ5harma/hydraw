import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { parseHexColor } from "@hydraw/document";
import type { HexColor } from "@hydraw/document";
import { Icon } from "../../components/icons.tsx";
import { getRecentColors, rememberColor, subscribeRecentColors } from "./recent-colors.ts";
import "./color-picker.css";

export function CustomColorPicker({
  value,
  suffix,
  custom,
  onChange,
}: {
  value: string;
  suffix: string;
  custom: boolean;
  onChange: (color: HexColor) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value === "transparent" ? "#ffffff" : value);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const hexInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const recent = useSyncExternalStore(subscribeRecentColors, getRecentColors);
  const color = parseHexColor(draft);

  function close(restore = true) {
    setOpen(false);
    if (restore) trigger.current?.focus();
  }
  function apply(next: HexColor) {
    onChange(next);
    rememberColor(next);
    close();
  }
  useEffect(() => {
    if (!open) return;
    hexInput.current?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div className="custom-color" ref={root}>
      <button
        ref={trigger}
        className={`swatch custom-color-trigger${custom ? " is-selected" : ""}`}
        style={custom ? { background: value } : undefined}
        aria-label={`Custom ${suffix} color`}
        title={`Custom ${suffix} color${custom ? ` · ${value}` : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (open) close();
          else {
            setDraft(value === "transparent" ? "#ffffff" : value);
            setOpen(true);
          }
        }}
      >
        <Icon name="plus" />
      </button>
      {open && (
        <div
          id={id}
          className="color-picker"
          role="group"
          aria-label={`Custom ${suffix} color picker`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
            if (event.key === "Enter" && event.target === hexInput.current) {
              event.preventDefault();
              event.stopPropagation();
              if (color) apply(color);
            }
          }}
        >
          <div className="color-picker-heading">
            <strong>Custom color</strong>
            <button
              type="button"
              className="color-picker-close"
              aria-label={`Close ${suffix} color picker`}
              onClick={() => close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="color-picker-inputs">
            <input
              type="color"
              aria-label={`Choose ${suffix} color`}
              value={color ?? parseHexColor(value) ?? "#ffffff"}
              onChange={(event) => setDraft(event.target.value)}
            />
            <label>
              HEX
              <input
                ref={hexInput}
                type="text"
                aria-label={`HEX ${suffix} color`}
                value={draft}
                spellCheck={false}
                autoComplete="off"
                maxLength={9}
                aria-invalid={!color}
                aria-describedby={!color ? `${id}-error` : undefined}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
          </div>
          {!color && (
            <p id={`${id}-error`} className="color-picker-error" role="alert">
              Enter a HEX color, like #5b8def.
            </p>
          )}
          {recent.length > 0 && (
            <div className="color-picker-recents">
              <span>Recent colors</span>
              <div role="group" aria-label="Recent colors">
                {recent.map((item) => (
                  <button
                    type="button"
                    key={item}
                    style={{ backgroundColor: item }}
                    aria-label={`Use ${item} for ${suffix}`}
                    title={item}
                    onClick={() => apply(item)}
                  />
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            className="export-button color-picker-apply"
            aria-label={`Apply ${suffix} color`}
            disabled={!color}
            onClick={() => color && apply(color)}
          >
            Apply color
          </button>
        </div>
      )}
    </div>
  );
}
