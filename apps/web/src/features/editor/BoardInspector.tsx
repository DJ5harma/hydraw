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
          <ColorSwatches
            palette={fillPalette}
            value={selected?.fill ?? snapshot.fill}
            onChange={(fill) => editor.setFill(fill)}
            label="Rectangle fill color"
            suffix="fill"
          />
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
      <ObjectList editor={editor} center={center} />
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
