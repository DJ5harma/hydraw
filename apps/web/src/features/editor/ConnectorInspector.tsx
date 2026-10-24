import { Icon } from "../../components/icons.tsx";
import { resolveConnector } from "@hydraw/document";
import type { BoardDocument, Connector, Endpoint } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { NumberField } from "./NumberField.tsx";
import { MAX_ENDPOINT_COORDINATE } from "@hydraw/document";
import { ColorSwatches, inkPalette } from "./ColorSwatches.tsx";
function endpointName(endpoint: Endpoint, document: BoardDocument): string {
  if (endpoint.type === "point") return "Canvas point";
  const index = document.shapes.findIndex((shape) => shape.id === endpoint.shapeId);
  const shape = document.shapes[index];
  return shape?.type === "ink"
    ? `Drawing ${index + 1}`
    : shape?.type === "image"
      ? `Image ${index + 1}`
      : shape?.type === "text"
        ? `Text ${index + 1}`
        : `Rectangle ${index + 1}`;
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
  const geometry = resolveConnector(connector, document.shapes);
  const defaultAxis =
    Math.abs(geometry.end.x - geometry.start.x) >= Math.abs(geometry.end.y - geometry.start.y)
      ? "x"
      : "y";
  const bound = connector.start.type === "binding" || connector.end.type === "binding";
  return (
    <section className="inspector-section connector-controls">
      <button className="file-button" onClick={() => editor.editText(connector.id)}>
        <Icon name="text" />
        {connector.label ? "Edit label" : "Add label"}
      </button>
      <section className="connector-routing" aria-label="Connector routing">
        <h3>Line type</h3>
        <div className="property-options" role="group" aria-label="Line type">
          <button
            className="file-button"
            aria-pressed={!connector.route}
            onClick={() => editor.setConnectorStyle({ route: undefined })}
          >
            <Icon name="connector" /> Straight
          </button>
          <button
            className="file-button"
            aria-pressed={Boolean(connector.route)}
            onClick={() =>
              editor.setConnectorStyle({
                route: connector.route ?? { type: "elbow", axis: defaultAxis },
              })
            }
          >
            <Icon name="elbow" /> Elbow
          </button>
        </div>
        {connector.route && (
          <>
            <div className="property-options" role="group" aria-label="Elbow direction">
              {(["x", "y"] as const).map((axis) => (
                <button
                  key={axis}
                  className="file-button"
                  aria-label={axis === "x" ? "Horizontal ends" : "Vertical ends"}
                  title={axis === "x" ? "Horizontal ends" : "Vertical ends"}
                  aria-pressed={connector.route?.axis === axis}
                  onClick={() =>
                    editor.setConnectorStyle({
                      route:
                        connector.route?.axis === axis ? connector.route : { type: "elbow", axis },
                    })
                  }
                >
                  <svg className="style-preview" viewBox="0 0 40 24" aria-hidden="true">
                    <path
                      d={axis === "x" ? "M4 4h16v16h16" : "M4 3v9h32v9"}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ))}
            </div>
            <NumberField
              className="text-size-field"
              label={`Bend ${connector.route.axis.toUpperCase()}`}
              name="Bend position"
              value={geometry.bend!.point[connector.route.axis]}
              min={-MAX_ENDPOINT_COORDINATE}
              max={MAX_ENDPOINT_COORDINATE}
              onCommit={(position) =>
                editor.setConnectorStyle({ route: { ...connector.route!, position } })
              }
            />
            <p className="connector-routing-help">Drag the square handle to move the bend.</p>
            {connector.route.position !== undefined && (
              <button
                className="file-button"
                onClick={() =>
                  editor.setConnectorStyle({
                    route: { type: "elbow", axis: connector.route!.axis },
                  })
                }
              >
                <Icon name="recover" /> Reset bend
              </button>
            )}
          </>
        )}
      </section>
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
