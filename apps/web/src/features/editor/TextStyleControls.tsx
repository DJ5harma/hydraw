import { MAX_FONT_SIZE, MIN_FONT_SIZE, TEXT_COLORS } from "@hydraw/document";
import type { TextShape } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { useEffect, useState } from "react";
import { Icon } from "../../components/icons.tsx";

const colorNames = ["Forest", "Blue", "Rose", "Ochre", "Ink"];
export function TextStyleControls({ shape, editor }: { shape: TextShape; editor: Editor }) {
  const [size, setSize] = useState(String(shape.fontSize));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setSize(String(shape.fontSize));
    setInvalid(false);
  }, [shape.fontSize]);
  function commitSize() {
    const value = Number(size);
    if (!size.trim() || !Number.isFinite(value) || value < MIN_FONT_SIZE || value > MAX_FONT_SIZE) {
      setInvalid(true);
      return;
    }
    editor.setTextStyle({ fontSize: value });
    setInvalid(false);
  }
  return (
    <section className="inspector-section text-style-controls">
      <h3>TEXT</h3>
      <button className="file-button edit-text-button" onClick={() => editor.editText(shape.id)}>
        Edit text
      </button>
      <label className="text-size-field">
        Font size
        <input
          aria-label="Font size"
          type="number"
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          value={size}
          aria-invalid={invalid}
          aria-describedby={invalid ? "font-size-error" : undefined}
          onChange={(event) => {
            setSize(event.target.value);
            setInvalid(false);
          }}
          onBlur={commitSize}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.stopPropagation();
              setSize(String(shape.fontSize));
              setInvalid(false);
            }
          }}
        />
      </label>
      {invalid && (
        <p id="font-size-error" className="text-field-error" role="alert">
          Use {MIN_FONT_SIZE} to {MAX_FONT_SIZE}.
        </p>
      )}
      <div className="text-options" role="group" aria-label="Text formatting">
        <button
          className="file-button"
          aria-label="Bold"
          aria-pressed={shape.fontWeight === 700}
          onClick={() => editor.setTextStyle({ fontWeight: shape.fontWeight === 700 ? 400 : 700 })}
        >
          <strong>B</strong>
        </button>
        {(["left", "center", "right"] as const).map((textAlign) => (
          <button
            key={textAlign}
            className="file-button"
            aria-label={`Align ${textAlign}`}
            aria-pressed={shape.textAlign === textAlign}
            onClick={() => editor.setTextStyle({ textAlign })}
          >
            {textAlign === "left" ? "Left" : textAlign === "center" ? "Center" : "Right"}
          </button>
        ))}
      </div>
      <div className="swatches" role="group" aria-label="Text color">
        {TEXT_COLORS.map((color, index) => (
          <button
            key={color}
            className={`swatch ${shape.color === color ? "is-selected" : ""}`}
            style={{ backgroundColor: color, color: "white" }}
            aria-label={`${colorNames[index]} text`}
            aria-pressed={shape.color === color}
            onClick={() => editor.setTextStyle({ color })}
          >
            {shape.color === color && <Icon name="check" />}
          </button>
        ))}
      </div>
      <p className="inspector-note">
        Double-click text or press Enter to edit. Resize its width to wrap; height grows
        automatically.
      </p>
    </section>
  );
}
