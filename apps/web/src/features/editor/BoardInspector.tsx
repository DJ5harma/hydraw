import { FILLS } from "@hydraw/document";
import type { Point } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import { TextStyleControls } from "./TextStyleControls.tsx";
import { GeometryFields } from "./GeometryFields.tsx";
const fillNames = ["Blue", "Sage", "Sand", "Rose", "White"];
export function BoardInspector({ editor, center }: { editor: Editor; center: () => Point }) {
  const snapshot = useEditorSnapshot(editor);
  const selected = snapshot.document.shapes.find((shape) => shape.id === snapshot.selectedId);
  return (
    <aside className="inspector" aria-label="Board inspector">
      <div className="inspector-heading">
        <h2>{selected?.type === "text" ? "Text" : selected ? "Rectangle" : "Your canvas"}</h2>
        <span className="small-label">{selected ? "SELECTED" : "LOCAL"}</span>
      </div>
      {selected?.type === "text" ? (
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
      <section className="inspector-section objects-section">
        <div className="objects-heading">
          <h3>
            <Icon name="layers" />
            OBJECTS
          </h3>
          <span>{snapshot.document.shapes.length}</span>
        </div>
        {snapshot.document.shapes.length === 0 ? (
          <p className="no-objects">
            A blank canvas.
            <br />A good place to begin.
          </p>
        ) : (
          <ul className="object-list">
            {snapshot.document.shapes.map((shape, index) => (
              <li key={shape.id}>
                <button
                  className={snapshot.selectedId === shape.id ? "selected-object" : ""}
                  aria-pressed={snapshot.selectedId === shape.id}
                  onClick={() => editor.select(shape.id)}
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
          </ul>
        )}
        <button className="add-object" onClick={() => editor.addRectangle(center())}>
          <Icon name="plus" />
          Add rectangle
        </button>
        <button className="add-object" onClick={() => editor.addText(center())}>
          <Icon name="text" />
          Add text
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
