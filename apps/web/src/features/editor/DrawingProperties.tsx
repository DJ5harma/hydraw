import type { TextColor } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { ColorSwatches, inkPalette } from "./ColorSwatches.tsx";
import { RangeField } from "./RangeField.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import "./drawing-properties.css";

export function InkStyleControls({
  editor,
  color,
  strokeWidth,
}: {
  editor: Editor;
  color: TextColor;
  strokeWidth: number;
}) {
  return (
    <section className="inspector-section">
      <ColorSwatches
        palette={inkPalette}
        value={color}
        onChange={(value) => editor.setInkStyle({ color: value })}
        label="Drawing color"
        suffix="drawing"
        ink
      />
      <RangeField
        label="Width"
        name="Drawing width"
        step={0.5}
        unit=" px"
        min={0.5}
        max={12}
        value={strokeWidth}
        onCommit={(value) => editor.setInkStyle({ strokeWidth: value })}
      />
    </section>
  );
}

export function DrawingProperties({ editor, hidden }: { editor: Editor; hidden: boolean }) {
  const snapshot = useEditorSnapshot(editor);
  if (hidden || snapshot.tool !== "draw" || snapshot.interacting) return null;
  return (
    <section className="drawing-properties" aria-label="Drawing properties">
      <strong>Draw freely</strong>
      <p>Hold briefly after a rectangle or ellipse to straighten it.</p>
      <InkStyleControls editor={editor} color={snapshot.inkColor} strokeWidth={snapshot.inkWidth} />
    </section>
  );
}
