import type { Point } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";

export function ObjectList({ editor, center }: { editor: Editor; center: () => Point }) {
  const snapshot = useEditorSnapshot(editor);
  const selectedIds = new Set(snapshot.selectedIds);
  return (
    <section className="inspector-section objects-section">
      <div className="objects-heading">
        <h3>
          <Icon name="layers" />
          OBJECTS
        </h3>
        <span>{snapshot.document.shapes.length + snapshot.document.connectors.length}</span>
      </div>
      <div className="object-list-scroll">
        {snapshot.document.shapes.length === 0 && snapshot.document.connectors.length === 0 ? (
          <p className="no-objects">No objects yet</p>
        ) : (
          <ul className="object-list">
            {snapshot.document.shapes.map((shape, index) => (
              <li key={shape.id}>
                <button
                  className={selectedIds.has(shape.id) ? "selected-object" : ""}
                  aria-pressed={selectedIds.has(shape.id)}
                  onClick={(event) => editor.select(shape.id, event.shiftKey)}
                >
                  <span
                    aria-hidden="true"
                    className="object-thumbnail"
                    style={{
                      backgroundColor: shape.type === "rectangle" ? shape.fill : "transparent",
                      color: shape.type === "text" ? shape.color : undefined,
                    }}
                  >
                    {shape.type === "text" ? "T" : null}
                  </span>
                  <span>
                    {shape.type === "text"
                      ? `Text ${index + 1} · ${shape.text.slice(0, 32)}`
                      : `Rectangle ${index + 1}`}
                  </span>
                </button>
              </li>
            ))}
            {snapshot.document.connectors.map((connector, index) => (
              <li key={connector.id}>
                <button
                  className={selectedIds.has(connector.id) ? "selected-object" : ""}
                  aria-pressed={selectedIds.has(connector.id)}
                  onClick={(event) => editor.select(connector.id, event.shiftKey)}
                >
                  <span
                    aria-hidden="true"
                    className="object-thumbnail connector-thumbnail"
                    style={{ color: connector.color }}
                  >
                    <Icon name="connector" />
                  </span>
                  <span>Connector {index + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {snapshot.document.shapes.length + snapshot.document.connectors.length > 0 && (
        <button
          className="select-all-objects"
          aria-label="Select all objects"
          onClick={() => editor.selectAll()}
        >
          Select all
        </button>
      )}
      <div className="add-object-row" role="group" aria-label="Add to board">
        <button
          className="add-object"
          aria-label="Add rectangle"
          title="Add rectangle"
          onClick={() => editor.addRectangle(center())}
        >
          <Icon name="plus" /> <span>Rectangle</span>
        </button>
        <button
          className="add-object"
          aria-label="Add text"
          title="Add text"
          onClick={() => editor.addText(center())}
        >
          <Icon name="text" /> <span>Text</span>
        </button>
        <button
          className="add-object"
          aria-label="Add connector"
          title="Add connector"
          onClick={() => editor.addConnector(center())}
        >
          <Icon name="connector" /> <span>Arrow</span>
        </button>
      </div>
    </section>
  );
}
