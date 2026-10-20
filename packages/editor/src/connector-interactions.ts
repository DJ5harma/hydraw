import {
  createConnectorResolver,
  distanceToSegment,
  hitTest,
  MAX_ENDPOINT_COORDINATE,
  resolveConnector,
} from "@hydraw/document";
import type { BoardDocument, Connector, Endpoint, Point, Shape } from "@hydraw/document";
import { clamp, screenToWorld } from "./geometry.ts";
import type { Camera, EditorSnapshot } from "./types.ts";

export type ConnectorEnd = "start" | "end";
export type ConnectorGesture =
  | { kind: "connect"; id: string; start: Endpoint }
  | { kind: "reconnect"; connector: Connector; endpoint: ConnectorEnd };

export function endpointAt(shapes: readonly Shape[], point: Point, tolerance: number): Endpoint {
  const shape =
    hitTest(shapes, point) ??
    shapes.findLast(
      (shape) =>
        point.x >= shape.x - tolerance &&
        point.x <= shape.x + shape.width + tolerance &&
        point.y >= shape.y - tolerance &&
        point.y <= shape.y + shape.height + tolerance,
    );
  return shape ? { type: "binding", shapeId: shape.id } : { type: "point", ...point };
}

export function hitConnector(
  document: BoardDocument,
  point: Point,
  tolerance: number,
): Connector | undefined {
  const resolve = createConnectorResolver(document.shapes);
  return document.connectors.findLast((connector) => {
    const { start, end } = resolve(connector);
    return distanceToSegment(point, start, end) <= tolerance;
  });
}

export function hitConnectorEnd(
  connector: Connector,
  shapes: readonly Shape[],
  screen: Point,
  camera: Camera,
): ConnectorEnd | null {
  const ends = resolveConnector(connector, shapes);
  let closest: ConnectorEnd | null = null;
  let distance = 9;
  for (const endpoint of ["start", "end"] as const) {
    const point = ends[endpoint];
    const next = Math.hypot(
      point.x * camera.zoom + camera.x - screen.x,
      point.y * camera.zoom + camera.y - screen.y,
    );
    if (next <= distance) {
      closest = endpoint;
      distance = next;
    }
  }
  return closest;
}

export function previewConnectorGesture(
  gesture: ConnectorGesture,
  screen: Point,
  camera: Camera,
  shapes: readonly Shape[],
): Partial<EditorSnapshot> {
  const raw = screenToWorld(screen, camera);
  const point = {
    x: clamp(raw.x, -MAX_ENDPOINT_COORDINATE, MAX_ENDPOINT_COORDINATE),
    y: clamp(raw.y, -MAX_ENDPOINT_COORDINATE, MAX_ENDPOINT_COORDINATE),
  };
  const endpoint = endpointAt(shapes, point, 10 / camera.zoom);
  return {
    connectorPreview:
      gesture.kind === "connect"
        ? {
            id: gesture.id,
            type: "connector",
            start: gesture.start,
            end: endpoint,
            color: "#243e33",
            arrowhead: "arrow",
          }
        : { ...gesture.connector, [gesture.endpoint]: endpoint },
    bindingTargetId: endpoint.type === "binding" ? endpoint.shapeId : null,
  };
}
