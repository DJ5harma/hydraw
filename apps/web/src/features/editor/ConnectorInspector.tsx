import { TEXT_COLORS } from "@hydraw/document";
import type { BoardDocument, Connector, Endpoint } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";

const colorNames = ["Forest", "Blue", "Rose", "Ochre", "Ink"];
function endpointName(endpoint: Endpoint, document: BoardDocument): string {
  if (endpoint.type === "point") return "Canvas point";
  const index = document.shapes.findIndex((shape) => shape.id === endpoint.shapeId);
  const shape = document.shapes[index];
  return shape?.type === "text" ? `Text ${index + 1}` : `Rectangle ${index + 1}`;
}

export function ConnectorInspector({
  connector,
  document,
  editor,
}: {
  connector: Connector;
  document: BoardDocument;
  editor: Editor;
}) {
  const bound = connector.start.type === "binding" || connector.end.type === "binding";
  return (
    <section className="inspector-section connector-controls">
      <h3>CONNECTION</h3>
      <dl className="connector-endpoints">
        <div>
          <dt>From</dt>
          <dd>{endpointName(connector.start, document)}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{endpointName(connector.end, document)}</dd>
        </div>
      </dl>
      <p className="inspector-note">
        Drag either endpoint to attach it to an object or leave it on the canvas. Attached ends
        follow their objects.
      </p>
      <label className="connector-arrowhead">
        <input
          type="checkbox"
          aria-label="Arrowhead"
          checked={connector.arrowhead === "arrow"}
          onChange={(event) =>
            editor.setConnectorStyle({ arrowhead: event.target.checked ? "arrow" : "none" })
          }
        />
        Arrowhead
      </label>
      <div className="swatches" role="group" aria-label="Connector color">
        {TEXT_COLORS.map((color, index) => (
          <button
            key={color}
            className={`swatch ${connector.color === color ? "is-selected" : ""}`}
            style={{ backgroundColor: color, color: "white" }}
            aria-label={`${colorNames[index]} connector`}
            aria-pressed={connector.color === color}
            onClick={() => editor.setConnectorStyle({ color })}
          >
            {connector.color === color && <Icon name="check" />}
          </button>
        ))}
      </div>
      <button className="file-button" onClick={() => editor.reverseConnector()}>
        Reverse direction
      </button>
      <button className="file-button" disabled={!bound} onClick={() => editor.detachConnector()}>
        Detach endpoints
      </button>
      <p className="inspector-note">
        {bound
          ? "To move the whole arrow, detach its ends first."
          : "Drag the line or use arrow keys to move it."}
      </p>
      <button className="delete-button" onClick={() => editor.removeSelection()}>
        <Icon name="trash" />
        Delete connector
      </button>
    </section>
  );
}
