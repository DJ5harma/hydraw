import type { Editor, Tool } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import "./canvas-controls.css";

const tools = [
  { id: "select", label: "Select", key: "V", icon: "select" },
  { id: "rectangle", label: "Rectangle", key: "R", icon: "rectangle", shapeKind: "rectangle" },
  { id: "rectangle", label: "Ellipse", key: "O", icon: "ellipse", shapeKind: "ellipse" },
  { id: "rectangle", label: "Diamond", key: "D", icon: "diamond", shapeKind: "diamond" },
  { id: "connector", label: "Connector", key: "C", icon: "connector" },
  { id: "text", label: "Text", key: "T", icon: "text" },
  { id: "draw", label: "Draw", key: "P", icon: "pen" },
  { id: "eraser", label: "Eraser", key: "E", icon: "eraser" },
  { id: "hand", label: "Hand", key: "H", icon: "hand" },
] as const;

export function EditorToolbar({
  editor,
  selectTool,
  onImage,
  onInsert,
  insertOpen,
}: {
  onImage: () => void;
  onInsert: () => void;
  insertOpen: boolean;
  editor: Editor;
  selectTool: (tool: Tool) => void;
}) {
  const snapshot = useEditorSnapshot(editor);
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      {tools.map((tool) => {
        const shape = "shapeKind" in tool;
        const pressed = shape
          ? snapshot.tool === "rectangle" && snapshot.shapeKind === tool.shapeKind
          : snapshot.tool === tool.id;
        return (
          <button
            key={tool.label}
            className={`tool-button ${pressed ? "is-active" : ""}`}
            aria-label={`${tool.label} (${tool.key})`}
            aria-pressed={pressed}
            title={`${tool.label} (${tool.key})`}
            onClick={() => {
              if (shape) editor.setShapeKind(tool.shapeKind);
              selectTool(tool.id);
            }}
          >
            <Icon name={tool.icon} />
            <kbd className="tool-shortcut" aria-hidden="true">
              {tool.key}
            </kbd>
          </button>
        );
      })}
      <button
        className="tool-button"
        aria-label="Insert image"
        title="Insert image"
        onClick={onImage}
      >
        <Icon name="image" />
      </button>
      <button
        className="tool-button"
        aria-label="Insert"
        title="Insert frames and presets"
        data-overlay-trigger="insert"
        aria-expanded={insertOpen}
        aria-haspopup="dialog"
        onClick={onInsert}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
