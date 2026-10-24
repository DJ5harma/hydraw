import { rectangleAppearance } from "@hydraw/document";
import type { Rectangle } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { ColorSwatches, fillPalette, inkPalette } from "./ColorSwatches.tsx";
import { RangeField } from "./RangeField.tsx";
import { Icon } from "../../components/icons.tsx";

const strokePalette = [{ color: "#364152", name: "Slate" }, ...inkPalette.slice(1)];

export function RectangleStyleControls({ shape, editor }: { shape: Rectangle; editor: Editor }) {
  const style = rectangleAppearance(shape);
  const kind = shape.kind ? shape.kind[0]!.toUpperCase() + shape.kind.slice(1) : "Rectangle";
  return (
    <div className="rectangle-style-controls">
      <button className="file-button" onClick={() => editor.editText(shape.id)}>
        <Icon name="text" />
        {shape.label ? "Edit label" : "Add label"}
      </button>
      <section>
        <h3>Stroke</h3>
        <ColorSwatches
          palette={strokePalette}
          value={style.stroke}
          onChange={(stroke) => editor.setRectangleStyle({ stroke })}
          label={`${kind} stroke color`}
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
          label={`${kind} fill color`}
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
              title={`${["Thin", "Medium", "Thick"][i]} stroke`}
              aria-label={`${["Thin", "Medium", "Thick"][i]} stroke`}
              aria-pressed={style.strokeWidth === width}
              onClick={() => editor.setRectangleStyle({ strokeWidth: width })}
            >
              <svg aria-hidden="true" viewBox="0 0 40 24" className="style-preview">
                <path
                  d="M6 12h28"
                  stroke="currentColor"
                  strokeWidth={width}
                  strokeLinecap="round"
                />
              </svg>
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
              title={`${strokeStyle} stroke`}
              aria-label={`${strokeStyle} stroke`}
              aria-pressed={style.strokeStyle === strokeStyle}
              onClick={() => editor.setRectangleStyle({ strokeStyle })}
            >
              <svg aria-hidden="true" viewBox="0 0 40 24" className="style-preview">
                <path
                  d="M4 12h32"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={
                    strokeStyle === "dashed" ? "7 5" : strokeStyle === "dotted" ? "1 5" : undefined
                  }
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ))}
        </div>
      </section>
      <section hidden={shape.kind === "ellipse" || shape.kind === "diamond"}>
        <h3>Corners</h3>
        <div className="property-options" role="group" aria-label="Corners">
          {([0, 8] as const).map((cornerRadius) => (
            <button
              key={cornerRadius}
              className="file-button"
              aria-label={cornerRadius ? "Rounded" : "Square"}
              title={cornerRadius ? "Rounded corners" : "Square corners"}
              aria-pressed={style.cornerRadius === cornerRadius}
              onClick={() => editor.setRectangleStyle({ cornerRadius })}
            >
              <svg aria-hidden="true" viewBox="0 0 40 24" className="style-preview">
                <path
                  d={cornerRadius ? "M10 21V11a8 8 0 0 1 8-8h12" : "M10 21V3h20"}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
          ))}
        </div>
      </section>
      <RangeField
        label="Opacity"
        unit="%"
        name="Shape opacity"
        min={0}
        max={100}
        value={style.opacity}
        onCommit={(opacity) => editor.setRectangleStyle({ opacity })}
      />
    </div>
  );
}
