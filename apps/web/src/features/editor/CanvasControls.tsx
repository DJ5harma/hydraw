import { useEffect, useRef, useState } from "react";
import type { Editor } from "@hydraw/editor";
import type { Point } from "@hydraw/document";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";

const shortcuts = [
  ["Select", "V"],
  ["Rectangle", "R"],
  ["Hand", "H"],
  ["Text", "T"],
  ["Connector", "C · drag / Enter"],
  ["Reconnect endpoint", "Drag endpoint handle"],
  ["Edit selected text", "Enter"],
  ["Save text draft", "Ctrl/⌘ Enter"],
  ["Create centered rectangle", "Enter"],
  ["Move selection", "Arrow keys"],
  ["Toggle object selection", "Shift + click"],
  ["Select enclosed objects", "Drag empty space"],
  ["Select all", "Ctrl/⌘ A"],
  ["Duplicate selection", "Ctrl/⌘ D"],
  ["Move by 10", "Shift + Arrow"],
  ["Delete selected object", "Delete"],
  ["Undo / redo", "Ctrl/⌘ Z / Shift Z"],
  ["Pan", "Space + drag"],
  ["Zoom", "Ctrl/⌘ + scroll"],
  ["Cancel gesture", "Esc"],
];

export function CanvasControls({ editor, center }: { editor: Editor; center: () => Point }) {
  const snapshot = useEditorSnapshot(editor);
  const [showHelp, setShowHelp] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const helpRef = useRef<HTMLElement>(null);

  function closeHelp(restoreFocus = true) {
    setShowHelp(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!showHelp) return;
    closeRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !helpRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        closeHelp(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const activeElement = document.activeElement;
      const belongsToHelp =
        (target instanceof Node && helpRef.current?.contains(target)) ||
        (target instanceof Node && triggerRef.current?.contains(target)) ||
        (activeElement instanceof Node && helpRef.current?.contains(activeElement)) ||
        (activeElement instanceof Node && triggerRef.current?.contains(activeElement));

      if (event.key === "Escape" && belongsToHelp) {
        event.preventDefault();
        event.stopPropagation();
        closeHelp();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [showHelp]);

  return (
    <>
      <div className="canvas-bottom">
        <div className="zoom-controls" role="group" aria-label="Canvas zoom">
          <button
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => editor.zoomAt(center(), 1 / 1.2)}
          >
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
          <button aria-label="Zoom in" title="Zoom in" onClick={() => editor.zoomAt(center(), 1.2)}>
            <Icon name="plus" />
          </button>
        </div>
        <p id="canvas-instructions">
          {snapshot.tool === "rectangle"
            ? "Drag to draw a rectangle"
            : snapshot.tool === "connector"
              ? "Drag between objects or canvas points"
              : snapshot.tool === "text"
                ? "Click to place text"
                : snapshot.tool === "hand"
                  ? "Drag to explore your canvas"
                  : "Drag to move · Shift-click or drag empty space to select"}
          <span> · </span>Hold <kbd>Space</kbd> to pan
        </p>
        <button
          ref={triggerRef}
          className="help-button"
          aria-label="Keyboard shortcuts"
          aria-expanded={showHelp}
          aria-haspopup="dialog"
          onClick={() => setShowHelp((open) => !open)}
        >
          ?
        </button>
      </div>
      {showHelp && (
        <aside
          ref={helpRef}
          className="shortcuts"
          role="dialog"
          aria-label="Keyboard shortcuts reference"
          aria-modal="false"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="shortcuts-heading">
            <h2>Keyboard shortcuts</h2>
            <button
              ref={closeRef}
              className="shortcuts-close"
              aria-label="Close keyboard shortcuts"
              onClick={() => closeHelp()}
            >
              ×
            </button>
          </div>
          <dl>
            {shortcuts.map(([label, key]) => (
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
