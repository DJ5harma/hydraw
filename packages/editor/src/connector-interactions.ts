import {
  createConnectorResolver,
  isFrame,
  distanceToSegment,
  hitTest,
  containsShape,
  sceneObjects,
  MAX_ENDPOINT_COORDINATE,
  resolveConnector,
} from "@hydraw/document";
import type { BoardDocument, Connector, Endpoint, Point, Rectangle, Shape } from "@hydraw/document";
import { labelClipBounds } from "./labels.ts";
import { clamp, screenToWorld } from "./geometry.ts";
import type { Camera, EditorSnapshot } from "./types.ts";

export type ConnectorEnd = "start" | "end";
export type ConnectorGesture =
  | { kind: "connect"; id: string; start: Endpoint }
  | { kind: "create-connected"; id: string; shapeId: string; source: Rectangle; start: Endpoint }
  | { kind: "reconnect"; connector: Connector; endpoint: ConnectorEnd };

export type ConnectionHandle = "north" | "east" | "south" | "west";

export function connectionHandlePoint(shape: Shape, handle: ConnectionHandle, zoom = 1): Point {
  const offset = 18 / zoom;
  switch (handle) {
    case "north":
      return { x: shape.x + shape.width / 2, y: shape.y - offset };
    case "east":
      return { x: shape.x + shape.width + offset, y: shape.y + shape.height / 2 };
    case "south":
      return { x: shape.x + shape.width / 2, y: shape.y + shape.height + offset };
    case "west":
      return { x: shape.x - offset, y: shape.y + shape.height / 2 };
  }
}

export function connectionHandleAt(
  shape: Shape,
  screen: Point,
  camera: Camera,
): ConnectionHandle | null {
  if (shape.type !== "rectangle" || shape.kind === "frame") return null;
  for (const handle of ["north", "east", "south", "west"] as const) {
    const point = connectionHandlePoint(shape, handle, camera.zoom);
    if (
      Math.hypot(
        point.x * camera.zoom + camera.x - screen.x,
        point.y * camera.zoom + camera.y - screen.y,
      ) <= 7
    )
      return handle;
  }
  return null;
}

export function endpointAt(shapes: readonly Shape[], point: Point, tolerance: number): Endpoint {
  const targets = shapes.filter((shape) => !isFrame(shape));
  const shape =
    hitTest(targets, point) ?? targets.findLast((shape) => containsShape(shape, point, tolerance));
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
      gesture.kind === "connect" || gesture.kind === "create-connected"
        ? {
            id: gesture.id,
            type: "connector",
            start: gesture.start,
            end: endpoint,
            color: "#243e33",
            arrowhead: "arrow",
          }
        : gesture.kind === "reconnect"
          ? { ...gesture.connector, [gesture.endpoint]: endpoint }
          : null,
    bindingTargetId: endpoint.type === "binding" ? endpoint.shapeId : null,
  };
}

/** Hit the same global stack that the renderer paints; locked hits can be inspected without permitting edits. */
export function hitSceneObject(
  document: BoardDocument,
  point: Point,
  tolerance: number,
  includeLocked = false,
): Shape | Connector | undefined {
  const resolve = createConnectorResolver(document.shapes);
  const lockedGroups = new Set(
    [...document.shapes, ...document.connectors]
      .filter((item) => item.locked && item.groupId)
      .map((item) => item.groupId),
  );
  return sceneObjects(document).findLast((object) => {
    if (!includeLocked && (object.locked || (object.groupId && lockedGroups.has(object.groupId))))
      return false;
    if (object.type !== "connector") {
      if (isFrame(object)) {
        const title = labelClipBounds(object, document.shapes);
        if (
          point.x >= title.x &&
          point.x <= title.x + title.width &&
          point.y >= title.y &&
          point.y <= title.y + title.height
        )
          return true;
        return (
          containsShape(object, point, tolerance) &&
          (Math.abs(point.x - object.x) <= tolerance ||
            Math.abs(point.x - object.x - object.width) <= tolerance ||
            Math.abs(point.y - object.y) <= tolerance ||
            Math.abs(point.y - object.y - object.height) <= tolerance)
        );
      }
      return containsShape(object, point);
    }
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
