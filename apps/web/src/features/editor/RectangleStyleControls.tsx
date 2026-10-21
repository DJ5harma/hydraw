import { rectangleAppearance } from "@hydraw/document";
import type { Rectangle } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { ColorSwatches, fillPalette, inkPalette } from "./ColorSwatches.tsx";
import { NumberField } from "./NumberField.tsx";

const strokePalette = [{ color: "#364152", name: "Slate" }, ...inkPalette.slice(1)];

export function RectangleStyleControls({ shape, editor }: { shape: Rectangle; editor: Editor }) {
  const style = rectangleAppearance(shape);
  return (
    <div className="rectangle-style-controls">
      <section>
        <h3>Stroke</h3>
        <ColorSwatches
          palette={strokePalette}
          value={style.stroke}
          onChange={(stroke) => editor.setRectangleStyle({ stroke })}
          label="Rectangle stroke color"
          suffix="stroke"
          ink
        />
      </section>
      <section>
        <h3>Background</h3>
        <ColorSwatches
          palette={fillPalette}
          value={shape.fill}
          onChange={(fill) => editor.setFill(fill)}
          label="Rectangle fill color"
          suffix="fill"
        />
      </section>
      <section>
        <h3>Stroke width</h3>
        <div className="property-options" role="group" aria-label="Stroke width">
          {([1.5, 3, 5] as const).map((width, i) => (
            <button
              key={width}
              className="file-button"
              aria-label={`${["Thin", "Medium", "Thick"][i]} stroke`}
              aria-pressed={style.strokeWidth === width}
              onClick={() => editor.setRectangleStyle({ strokeWidth: width })}
            >
              {["Thin", "Medium", "Thick"][i]}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Stroke style</h3>
        <div className="property-options" role="group" aria-label="Stroke style">
          {(["solid", "dashed", "dotted"] as const).map((strokeStyle) => (
            <button
              key={strokeStyle}
              className="file-button"
              aria-label={`${strokeStyle} stroke`}
              aria-pressed={style.strokeStyle === strokeStyle}
              onClick={() => editor.setRectangleStyle({ strokeStyle })}
            >
              {strokeStyle}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Corners</h3>
        <div className="property-options" role="group" aria-label="Corners">
          {([0, 8] as const).map((cornerRadius) => (
            <button
              key={cornerRadius}
              className="file-button"
              aria-pressed={style.cornerRadius === cornerRadius}
              onClick={() => editor.setRectangleStyle({ cornerRadius })}
            >
              {cornerRadius ? "Rounded" : "Square"}
            </button>
          ))}
        </div>
      </section>
      <NumberField
        className="text-size-field"
        label="Opacity %"
        name="Shape opacity"
        min={0}
        max={100}
        value={style.opacity}
        onCommit={(opacity) => editor.setRectangleStyle({ opacity })}
      />
    </div>
  );
}
