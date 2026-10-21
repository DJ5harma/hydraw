import type { Editor, Tool } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import "./canvas-controls.css";
const tools: { id: Tool; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "V" },
  { id: "rectangle", label: "Rectangle", key: "R" },
  { id: "connector", label: "Connector", key: "C" },
  { id: "text", label: "Text", key: "T" },
  { id: "hand", label: "Hand", key: "H" },
];
export function EditorToolbar({
  editor,
  selectTool,
}: {
  editor: Editor;
  selectTool: (tool: Tool) => void;
}) {
  const snapshot = useEditorSnapshot(editor);
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`tool-button ${snapshot.tool === tool.id ? "is-active" : ""}`}
          aria-label={`${tool.label} (${tool.key})`}
          aria-pressed={snapshot.tool === tool.id}
          title={`${tool.label} (${tool.key})`}
          onClick={() => selectTool(tool.id)}
        >
          <Icon name={tool.id} />
        </button>
      ))}
    </div>
  );
}
