import type { RefObject, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Editor, Tool } from "@hydraw/editor";
export function createEditorControls(
  editor: Editor,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  duplicate: () => void,
) {
  function center() {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: (rect?.width ?? 800) / 2, y: (rect?.height ?? 600) / 2 };
  }

  function selectTool(tool: Tool) {
    editor.setTool(tool);
    canvasRef.current?.focus();
  }

  const keyboard = createKeyboardHandler(editor, center, selectTool, duplicate);
  return { center, selectTool, keyboard };
}

function createKeyboardHandler(
  editor: Editor,
  center: () => { x: number; y: number },
  selectTool: (tool: Tool) => void,
  duplicate: () => void,
) {
  return (event: ReactKeyboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('input, textarea, select, dialog, [contenteditable="true"], [role="dialog"]')
    )
      return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === "g") {
      event.preventDefault();
      if (editor.getSnapshot().selectedIds.length) {
        if (event.shiftKey) editor.ungroupSelection();
        else editor.groupSelection();
      }
    } else if (mod && event.shiftKey && key === "l") {
      event.preventDefault();
      const snapshot = editor.getSnapshot();
      const selected = new Set(snapshot.selectedIds);
      if (selected.size) {
        const locked = [...snapshot.document.shapes, ...snapshot.document.connectors].some(
          (item) => selected.has(item.id) && item.locked,
        );
        editor.setSelectionLocked(!locked);
      }
    } else if (mod && (event.code === "BracketRight" || event.code === "BracketLeft")) {
      event.preventDefault();
      if (editor.getSnapshot().selectedIds.length) {
        const forward = event.code === "BracketRight";
        editor.orderSelection(
          event.shiftKey ? (forward ? "front" : "back") : forward ? "forward" : "backward",
        );
      }
    } else if (mod && key === "a") {
      event.preventDefault();
      editor.selectAll();
    } else if (mod && key === "d") {
      event.preventDefault();
      duplicate();
    } else if (mod && key === "z") {
      event.preventDefault();
      if (event.shiftKey) editor.redo();
      else editor.undo();
    } else if (mod && key === "y") {
      event.preventDefault();
      editor.redo();
    } else if (!mod && !event.altKey) {
      if (target instanceof HTMLElement && target.closest("button, a")) return;
      if (key === "v") selectTool("select");
      else if (key === "r" || key === "o" || key === "d") {
        editor.setShapeKind(key === "o" ? "ellipse" : key === "d" ? "diamond" : "rectangle");
        selectTool("rectangle");
      } else if (key === "f") {
        editor.setShapeKind("frame");
        selectTool("rectangle");
      } else if (key === "c") selectTool("connector");
      else if (key === "t") selectTool("text");
      else if (key === "h") selectTool("hand");
      else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        editor.removeSelection();
      } else if (key === "escape") {
        editor.cancelGesture();
        editor.select(null);
      } else if (key === "enter") {
        event.preventDefault();
        const snapshot = editor.getSnapshot();
        if (snapshot.tool === "select" && snapshot.selectedId) editor.editText();
        else if (snapshot.tool === "text") editor.addText(center(), "center");
        else if (snapshot.tool === "connector") editor.addConnector(center());
        else editor.addRectangle(center());
      } else if (key.startsWith("arrow")) {
        event.preventDefault();
        const distance = event.shiftKey ? 10 : 1;
        editor.nudgeSelection(
          key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0,
          key === "arrowup" ? -distance : key === "arrowdown" ? distance : 0,
        );
      }
    }
  };
}
