import {
  createConnectorResolver,
  distanceToSegment,
  hitTest,
  containsShape,
  sceneObjects,
  MAX_ENDPOINT_COORDINATE,
  resolveConnector,
} from "@hydraw/document";
import type { BoardDocument, Connector, Endpoint, Point, Shape } from "@hydraw/document";
import { labelClipBounds } from "./labels.ts";
import { clamp, screenToWorld } from "./geometry.ts";
import type { Camera, EditorSnapshot } from "./types.ts";

export type ConnectorEnd = "start" | "end";
export type ConnectorGesture =
  | { kind: "connect"; id: string; start: Endpoint }
  | { kind: "reconnect"; connector: Connector; endpoint: ConnectorEnd };

export function endpointAt(shapes: readonly Shape[], point: Point, tolerance: number): Endpoint {
  const shape =
    hitTest(shapes, point) ?? shapes.findLast((shape) => containsShape(shape, point, tolerance));
  return shape ? { type: "binding", shapeId: shape.id } : { type: "point", ...point };
}

export function hitConnector(
  document: BoardDocument,
  point: Point,
  tolerance: number,
): Connector | undefined {
  const resolve = createConnectorResolver(document.shapes);
  return document.connectors
    .toSorted((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .findLast((connector) => {
      const { start, end } = resolve(connector);
      if (distanceToSegment(point, start, end) <= tolerance) return true;
      if (!connector.label?.text.trim()) return false;
      const bounds = labelClipBounds(connector, document.shapes);
      return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      );
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

/** Hit the same global stack that the renderer paints; locked objects are transparent to selection. */
export function hitSceneObject(
  document: BoardDocument,
  point: Point,
  tolerance: number,
): Shape | Connector | undefined {
  const resolve = createConnectorResolver(document.shapes);
  const lockedGroups = new Set(
    [...document.shapes, ...document.connectors]
      .filter((item) => item.locked && item.groupId)
      .map((item) => item.groupId),
  );
  return sceneObjects(document).findLast((object) => {
    if (object.locked || (object.groupId && lockedGroups.has(object.groupId))) return false;
    if (object.type !== "connector") return containsShape(object, point);
    const ends = resolve(object);
    if (distanceToSegment(point, ends.start, ends.end) <= tolerance) return true;
    if (!object.label?.text.trim()) return false;
    const box = labelClipBounds(object, document.shapes, ends);
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  });
}
