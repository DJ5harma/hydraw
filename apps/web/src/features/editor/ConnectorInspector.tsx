import type { BoardDocument, Connector, Endpoint } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { ColorSwatches, inkPalette } from "./ColorSwatches.tsx";
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
      <h3>Connector</h3>
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
      <ColorSwatches
        palette={inkPalette}
        value={connector.color}
        onChange={(color) => editor.setConnectorStyle({ color })}
        label="Connector color"
        suffix="connector"
        ink
      />
      <button
        className="file-button"
        title="Reverse the connector direction"
        onClick={() => editor.reverseConnector()}
      >
        Reverse direction
      </button>
      <button
        className="file-button"
        title="Detach both endpoints from their objects"
        disabled={!bound}
        onClick={() => editor.detachConnector()}
      >
        Detach endpoints
      </button>
    </section>
  );
}
