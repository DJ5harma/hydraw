import type { RefObject, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Editor, Tool } from "@hydraw/editor";
export function createEditorControls(
  editor: Editor,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  function center() {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: (rect?.width ?? 800) / 2, y: (rect?.height ?? 600) / 2 };
  }

  function selectTool(tool: Tool) {
    editor.setTool(tool);
    canvasRef.current?.focus();
  }

  const keyboard = createKeyboardHandler(editor, center, selectTool);
  return { center, selectTool, keyboard };
}

function createKeyboardHandler(
  editor: Editor,
  center: () => { x: number; y: number },
  selectTool: (tool: Tool) => void,
) {
  return (event: ReactKeyboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('input, textarea, select, [contenteditable="true"]')
    )
      return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === "z") {
      event.preventDefault();
      if (event.shiftKey) editor.redo();
      else editor.undo();
    } else if (mod && key === "y") {
      event.preventDefault();
      editor.redo();
    } else if (!mod && !event.altKey) {
      if (target instanceof HTMLElement && target.closest("button, a")) return;
      if (key === "v") selectTool("select");
      else if (key === "r") selectTool("rectangle");
      else if (key === "h") selectTool("hand");
      else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        editor.removeSelection();
      } else if (key === "escape") {
        editor.cancelGesture();
        editor.select(null);
      } else if (key === "enter") {
        event.preventDefault();
        editor.addRectangle(center());
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
