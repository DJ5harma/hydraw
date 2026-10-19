import { FILLS } from "@hydraw/document";
import type { Point, Alignment, DistributionAxis } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import { TextStyleControls } from "./TextStyleControls.tsx";
import { ConnectorInspector } from "./ConnectorInspector.tsx";
import { ArrangementControls } from "./ArrangementControls.tsx";
import { GeometryFields } from "./GeometryFields.tsx";
const fillNames = ["Blue", "Sage", "Sand", "Rose", "White"];
export function BoardInspector({
  editor,
  center,
  onDuplicate,
  onAlign,
  onDistribute,
}: {
  editor: Editor;
  center: () => Point;
  onDuplicate: () => void;
  onAlign: (alignment: Alignment) => void;
  onDistribute: (axis: DistributionAxis) => void;
}) {
  const snapshot = useEditorSnapshot(editor);
  const selected = snapshot.document.shapes.find((shape) => shape.id === snapshot.selectedId);
  const selectedConnector = snapshot.document.connectors.find(
    (connector) => connector.id === snapshot.selectedId,
  );
  const selectedIds = new Set(snapshot.selectedIds);
  const multiple = selectedIds.size > 1;
  return (
    <aside className="inspector" aria-label="Board inspector">
      <div className="inspector-heading">
        <h2>
          {multiple
            ? `${selectedIds.size} objects`
            : selectedConnector
              ? "Connector"
              : selected?.type === "text"
                ? "Text"
                : selected
                  ? "Rectangle"
                  : "Your canvas"}
        </h2>
        <span className="small-label">{selectedIds.size ? "SELECTED" : "LOCAL"}</span>
      </div>
      {multiple ? (
        <section className="inspector-section">
          <h3>SELECTION</h3>
          <p className="inspector-note">
            Drag a selected object or use arrow keys to move the selection. Shift-click to add or
            remove objects.
          </p>
          <button className="delete-button" onClick={() => editor.removeSelection()}>
            <Icon name="trash" />
            Delete selection
          </button>
        </section>
      ) : selectedConnector ? (
        <ConnectorInspector
          connector={selectedConnector}
          document={snapshot.document}
          editor={editor}
        />
      ) : selected?.type === "text" ? (
        <TextStyleControls key={selected.id} shape={selected} editor={editor} />
      ) : (
        <section className="inspector-section">
          <h3>FILL COLOR</h3>
          <div className="swatches" role="group" aria-label="Rectangle fill color">
            {FILLS.map((fill, index) => (
              <button
                key={fill}
                style={{ backgroundColor: fill }}
                aria-label={`${fillNames[index]} fill`}
                aria-pressed={(selected?.fill ?? snapshot.fill) === fill}
                className={`swatch ${(selected?.fill ?? snapshot.fill) === fill ? "is-selected" : ""}`}
                onClick={() => editor.setFill(fill)}
              >
                {(selected?.fill ?? snapshot.fill) === fill && <Icon name="check" />}
              </button>
            ))}
          </div>
          <p className="inspector-note">
            {selected
              ? "A little color, a little clarity."
              : "Choose a color for your next rectangle."}
          </p>
        </section>
      )}
      {selected && (
        <section className="inspector-section">
          <h3>GEOMETRY</h3>
          <GeometryFields key={selected.id} shape={selected} editor={editor} />
          <button className="delete-button" onClick={() => editor.removeSelection()}>
            <Icon name="trash" />
            Delete {selected.type === "text" ? "text" : "rectangle"}
          </button>
        </section>
      )}
      {multiple && (
        <ArrangementControls
          shapeCount={snapshot.document.shapes.filter((shape) => selectedIds.has(shape.id)).length}
          onAlign={onAlign}
          onDistribute={onDistribute}
        />
      )}
      {selectedIds.size > 0 && (
        <section className="inspector-section selection-actions">
          <button className="file-button" onClick={onDuplicate}>
            <Icon name="duplicate" />
            Duplicate selection
          </button>
          <p className="inspector-note">Ctrl/⌘ D · Connected copies keep their internal arrows.</p>
          <button className="add-object" onClick={() => editor.select(null)}>
            Clear selection
          </button>
        </section>
      )}
      <section className="inspector-section objects-section">
        <div className="objects-heading">
          <h3>
            <Icon name="layers" />
            OBJECTS
          </h3>
          <span>{snapshot.document.shapes.length + snapshot.document.connectors.length}</span>
        </div>
        {snapshot.document.shapes.length === 0 && snapshot.document.connectors.length === 0 ? (
          <p className="no-objects">
            A blank canvas.
            <br />A good place to begin.
          </p>
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
        {snapshot.document.shapes.length + snapshot.document.connectors.length > 0 && (
          <button className="add-object" onClick={() => editor.selectAll()}>
            Select all objects
          </button>
        )}
        <button className="add-object" onClick={() => editor.addRectangle(center())}>
          <Icon name="plus" />
          Add rectangle
        </button>
        <button className="add-object" onClick={() => editor.addText(center())}>
          <Icon name="text" />
          Add text
        </button>
        <button className="add-object" onClick={() => editor.addConnector(center())}>
          <Icon name="connector" />
          Add connector
        </button>
      </section>
      <div className="inspector-footer">
        <span className="footer-flower">✳</span>
        <p>
          A little less friction.
          <br />A little more possibility.
        </p>
        <span>HYDRAW · LOCAL ALPHA 01</span>
      </div>
    </aside>
  );
}
