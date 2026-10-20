import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "@hydraw/document";
import type { TextShape } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { NumberField } from "./NumberField.tsx";
import { ColorSwatches, inkPalette } from "./ColorSwatches.tsx";

export function TextStyleControls({ shape, editor }: { shape: TextShape; editor: Editor }) {
  return (
    <section className="inspector-section text-style-controls">
      <h3>Text</h3>
      <button className="file-button edit-text-button" onClick={() => editor.editText(shape.id)}>
        Edit text
      </button>
      <NumberField
        label="Font size"
        name="Font size"
        className="text-size-field"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        value={shape.fontSize}
        onCommit={(fontSize) => editor.setTextStyle({ fontSize })}
      />
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
      <ColorSwatches
        palette={inkPalette}
        value={shape.color}
        onChange={(color) => editor.setTextStyle({ color })}
        label="Text color"
        suffix="text"
        ink
      />
    </section>
  );
}
