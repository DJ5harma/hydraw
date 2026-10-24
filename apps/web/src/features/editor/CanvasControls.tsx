import type { Editor } from "@hydraw/editor";
import type { WorkspaceOverlay } from "./useWorkspaceOverlay.ts";
import type { Point } from "@hydraw/document";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";

const shortcuts = [
  ["Freehand drawing", "P"],
  ["Whole-stroke eraser", "E · drag"],
  ["Recognize a drawn rectangle / ellipse", "Hold briefly before releasing"],
  ["Select", "V"],
  ["Context actions", "Right-click / Shift F10 / long-press"],
  ["Rectangle / ellipse / diamond", "R / O / D"],
  ["Hand", "H"],
  ["Text", "T"],
  ["Draw frame", "F · drag / Enter"],
  ["Connector", "C · drag / Enter"],
  ["Reconnect endpoint", "Drag endpoint handle"],
  ["Edit selected text or label", "Enter / double-click"],
  ["Save text draft", "Ctrl/⌘ Enter"],
  ["Create centered shape", "Shape tool + Enter"],
  ["Move selection", "Arrow keys"],
  ["Toggle object selection", "Shift + click"],
  ["Select enclosed objects", "Drag empty space"],
  ["Select all", "Ctrl/⌘ A"],
  ["Duplicate selection", "Ctrl/⌘ D"],
  ["Copy / cut / paste", "Ctrl/⌘ C / X / V"],
  ["Group / ungroup", "Ctrl/⌘ G / Shift G"],
  ["Lock / unlock selection", "Ctrl/⌘ Shift L"],
  ["Forward / backward", "Ctrl/⌘ ] / ["],
  ["Front / back", "Ctrl/⌘ Shift ] / ["],
  ["Bypass smart guides", "Alt while dragging"],
  ["Move by 10", "Shift + Arrow"],
  ["Delete selected object", "Delete"],
  ["Undo / redo", "Ctrl/⌘ Z / Shift Z"],
  ["Pan", "Space + drag"],
  ["Zoom", "Ctrl/⌘ + scroll"],
  ["Cancel gesture", "Esc"],
];

export function CanvasControls({
  editor,
  center,
  overlay,
  onOverlay,
  onFit,
  fitLabel,
}: {
  editor: Editor;
  center: () => Point;
  overlay: WorkspaceOverlay;
  onOverlay: (name: WorkspaceOverlay) => void;
  onFit: () => void;
  fitLabel: string;
}) {
  const snapshot = useEditorSnapshot(editor);
  const showHelp = overlay === "help";
  function closeHelp() {
    onOverlay(null);
  }

  return (
    <>
      <div className="canvas-bottom">
        <div className="canvas-history" role="group" aria-label="History">
          <button
            aria-label="Undo"
            title="Undo · Ctrl/⌘ Z"
            disabled={!snapshot.canUndo}
            onClick={() => editor.undo()}
          >
            <Icon name="undo" />
          </button>
          <button
            aria-label="Redo"
            title="Redo · Ctrl/⌘ Shift Z"
            disabled={!snapshot.canRedo}
            onClick={() => editor.redo()}
          >
            <Icon name="redo" />
          </button>
        </div>
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
            {snapshot.zoom < 0.01 ? "<1" : Math.round(snapshot.zoom * 100)}%
          </button>
          <button aria-label="Zoom in" title="Zoom in" onClick={() => editor.zoomAt(center(), 1.2)}>
            <Icon name="plus" />
          </button>
          <button className="fit-button" aria-label={fitLabel} title={fitLabel} onClick={onFit}>
            Fit
          </button>
        </div>
        <div className="canvas-controls-spacer" />
        <div className="help-overlay-root" data-workspace-overlay-root>
          <button
            className="help-button"
            data-overlay-trigger="help"
            aria-label="Keyboard shortcuts"
            aria-expanded={showHelp}
            aria-haspopup="dialog"
            onClick={() => onOverlay(showHelp ? null : "help")}
          >
            ?
          </button>
          {showHelp && (
            <aside
              className="shortcuts"
              role="dialog"
              aria-label="Keyboard shortcuts"
              aria-modal="false"
            >
              <div className="shortcuts-heading">
                <h2>Keyboard shortcuts</h2>
                <button
                  className="shortcuts-close"
                  aria-label="Close keyboard shortcuts"
                  onClick={closeHelp}
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
        </div>
      </div>
    </>
  );
}
