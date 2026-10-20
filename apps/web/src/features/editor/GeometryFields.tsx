import { MAX_COORDINATE, MAX_SIZE } from "@hydraw/document";
import type { Shape } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";

import { NumberField } from "./NumberField.tsx";

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
          <NumberField
            className="geometry-field"
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
