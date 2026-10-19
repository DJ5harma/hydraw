import { useState } from "react";
import type { Editor } from "@hydraw/editor";
import type { Point } from "@hydraw/document";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
export function CanvasControls({ editor, center }: { editor: Editor; center: () => Point }) {
  const snapshot = useEditorSnapshot(editor);
  const [showHelp, setShowHelp] = useState(false);
  return (
    <>
      <div className="canvas-bottom">
        <div className="zoom-controls" role="group" aria-label="Canvas zoom">
          <button aria-label="Zoom out" onClick={() => editor.zoomAt(center(), 1 / 1.2)}>
            <Icon name="minus" />
          </button>
          <button
            className="zoom-value"
            aria-label="Reset view"
            title="Reset view"
            onClick={() => editor.resetCamera()}
          >
            {Math.round(snapshot.zoom * 100)}%
          </button>
          <button aria-label="Zoom in" onClick={() => editor.zoomAt(center(), 1.2)}>
            <Icon name="plus" />
          </button>
        </div>
        <p id="canvas-instructions">
          {snapshot.tool === "rectangle"
            ? "Drag to draw a rectangle"
            : snapshot.tool === "hand"
              ? "Drag to explore your canvas"
              : "Select and drag to move"}
          <span> · </span>Hold <kbd>Space</kbd> to pan
        </p>
        <button
          className="help-button"
          aria-label="Keyboard shortcuts"
          aria-expanded={showHelp}
          onClick={() => setShowHelp(!showHelp)}
        >
          ?
        </button>
      </div>
      {showHelp && (
        <aside className="shortcuts" aria-label="Keyboard shortcuts reference">
          <h2>A few useful shortcuts</h2>
          <dl>
            {[
              ["Select", "V"],
              ["Rectangle", "R"],
              ["Hand", "H"],
              ["Create centered rectangle", "Enter"],
              ["Move selected rectangle", "Arrow keys"],
              ["Move by 10", "Shift + Arrow"],
              ["Delete selected rectangle", "Delete"],
              ["Undo / redo", "Ctrl/⌘ Z / Shift Z"],
              ["Pan", "Space + drag"],
              ["Zoom", "Ctrl/⌘ + scroll"],
              ["Cancel gesture", "Esc"],
            ].map(([label, key]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </>
  );
}
