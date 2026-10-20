import type { Point, Alignment, DistributionAxis } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import { TextStyleControls } from "./TextStyleControls.tsx";
import { ConnectorInspector } from "./ConnectorInspector.tsx";
import { ArrangementControls } from "./ArrangementControls.tsx";
import { GeometryFields } from "./GeometryFields.tsx";
import { ColorSwatches, fillPalette } from "./ColorSwatches.tsx";
import { ObjectList } from "./ObjectList.tsx";
import "./inspector.css";
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
    <aside id="board-inspector" className="inspector" aria-label="Board inspector">
      <div className="inspector-heading">
        <h2>Properties</h2>
        {multiple && <span className="inspector-count">{selectedIds.size} selected</span>}
      </div>
      {multiple ? (
        <section className="inspector-section selection-properties">
          <h3>{selectedIds.size} objects</h3>
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
          <h3>Fill</h3>
          <ColorSwatches
            palette={fillPalette}
            value={selected?.fill ?? snapshot.fill}
            onChange={(fill) => editor.setFill(fill)}
            label="Rectangle fill color"
            suffix="fill"
          />
        </section>
      )}
      {selected && (
        <section className="inspector-section">
          <h3>Geometry</h3>
          <GeometryFields key={selected.id} shape={selected} editor={editor} />
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
        <section className="inspector-section selection-actions" aria-label="Selection actions">
          <button
            className="file-button"
            aria-label="Duplicate selection"
            title="Duplicate selection"
            onClick={onDuplicate}
          >
            <Icon name="duplicate" /> <span>Duplicate</span>
          </button>
          <button
            className="delete-button"
            aria-label={
              multiple
                ? "Delete selection"
                : selectedConnector
                  ? "Delete connector"
                  : `Delete ${selected?.type === "text" ? "text" : "rectangle"}`
            }
            title={
              multiple
                ? "Delete selection"
                : selectedConnector
                  ? "Delete connector"
                  : `Delete ${selected?.type === "text" ? "text" : "rectangle"}`
            }
            onClick={() => editor.removeSelection()}
          >
            <Icon name="trash" />
            <span>Delete</span>
          </button>
          <button className="clear-selection" onClick={() => editor.select(null)}>
            Clear selection
          </button>
        </section>
      )}
      <ObjectList editor={editor} center={center} />
    </aside>
  );
}
