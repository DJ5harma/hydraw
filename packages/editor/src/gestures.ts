import {
  expandGroups,
  lockedObjectIds,
  frameSelectionContents,
  MAX_CONNECTORS,
  MAX_COORDINATE,
  MAX_ENDPOINT_COORDINATE,
  MAX_SHAPES,
  MAX_SIZE,
  rectangleBetween,
  resolveConnector,
} from "@hydraw/document";
import { makeInkShape } from "@hydraw/document";
import type { Fill, InkShape, Point, Shape, ShapeKind } from "@hydraw/document";
import {
  clamp,
  handlePoint,
  hitResizeHandle,
  resizeShape,
  resizedHandle,
  screenToWorld,
} from "./geometry.ts";
import type { ResizeHandle } from "./geometry.ts";
import type { Camera, EditorSnapshot } from "./types.ts";

import { previewSelectionGesture } from "./selection.ts";
import type { SelectionGesture } from "./selection.ts";
import type { ConnectorGesture } from "./connector-interactions.ts";
import {
  endpointAt,
  connectionHandleAt,
  hitSceneObject,
  hitConnectorEnd,
  hitConnectorBend,
  previewConnectorGesture,
} from "./connector-interactions.ts";

export type Gesture =
  | SelectionGesture
  | ConnectorGesture
  | { kind: "draw"; start: Point; id: string; shapeKind: ShapeKind }
  | {
      kind: "ink";
      start: Point;
      id: string;
      points: readonly Point[];
      bounds: Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;
      recognized: boolean;
      recognitionAnchor: Point | null;
    }
  | { kind: "erase"; last: Point; erasedIds: readonly string[] }
  | { kind: "resize"; start: Point; shape: Shape; handle: ResizeHandle }
  | { kind: "pan"; start: Point; camera: Camera };

export function previewGesture(
  gesture: Gesture,
  screen: Point,
  camera: Camera,
  fill: Fill,
  document: EditorSnapshot["document"],
  snapping = true,
): Partial<EditorSnapshot> {
  if (gesture.kind === "marquee" || gesture.kind === "move-selection")
    return previewSelectionGesture(gesture, screen, camera, document, snapping);
  if (
    gesture.kind === "connect" ||
    gesture.kind === "reconnect" ||
    gesture.kind === "bend-connector" ||
    gesture.kind === "create-connected"
  )
    return previewConnectorGesture(gesture, screen, camera, document.shapes);
  if (gesture.kind === "ink" || gesture.kind === "erase") return {};
  if (gesture.kind === "pan")
    return {
      camera: {
        ...gesture.camera,
        x: gesture.camera.x + screen.x - gesture.start.x,
        y: gesture.camera.y + screen.y - gesture.start.y,
      },
    };
  const raw = screenToWorld(screen, camera);
  if (gesture.kind === "resize") {
    const start = handlePoint(gesture.shape, gesture.handle);
    const point = { x: start.x + raw.x - gesture.start.x, y: start.y + raw.y - gesture.start.y };
    return {
      preview: resizeShape(gesture.shape, gesture.handle, point),
      activeHandle: resizedHandle(gesture.shape, gesture.handle, point),
    };
  }
  const point = {
    x: clamp(raw.x, -MAX_COORDINATE, MAX_COORDINATE),
    y: clamp(raw.y, -MAX_COORDINATE, MAX_COORDINATE),
  };
  const end = {
    x: clamp(point.x, gesture.start.x - MAX_SIZE, gesture.start.x + MAX_SIZE),
    y: clamp(point.y, gesture.start.y - MAX_SIZE, gesture.start.y + MAX_SIZE),
  };
  return { preview: rectangleBetween(gesture.id, gesture.start, end, fill, gesture.shapeKind) };
}

export const IDLE_GESTURE = Object.freeze({
  guides: [],
  preview: null,
  selectionPreview: null,
  marquee: null,
  connectorPreview: null,
  bindingTargetId: null,
  activeEndpoint: null,
  activeConnectorBend: null,
  interacting: false,
  activeHandle: null,
  erasedIds: Object.freeze([]),
  eraserCursor: null,
});

type GestureStart = Readonly<{ gesture: Gesture | null; patch: Partial<EditorSnapshot> }>;

/** Pure pointer planning. The coordinator owns text drafts, transactions and publication. */
export function startGesture(
  snapshot: EditorSnapshot,
  screen: Point,
  makeId: () => string,
  pan = false,
  additive = false,
): GestureStart | null {
  const { camera, document, tool, fill, selectedIds, selectedId } = snapshot;
  const raw = screenToWorld(screen, camera);
  if (pan || tool === "hand")
    return { gesture: { kind: "pan", start: screen, camera }, patch: { interacting: true } };
  if (tool === "text") return null;
  if (tool === "draw") {
    if (document.shapes.length >= MAX_SHAPES) return null;
    const start = {
      x: clamp(raw.x, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(raw.y, -MAX_COORDINATE, MAX_COORDINATE),
    };
    const id = makeId();
    const initial = makeInkShape(id, [start], snapshot.inkColor, snapshot.inkWidth);
    return {
      gesture: {
        kind: "ink",
        start,
        id,
        points: [start],
        bounds: { minX: start.x, minY: start.y, maxX: start.x, maxY: start.y },
        recognized: false,
        recognitionAnchor: null,
      },
      patch: { interacting: true, selectedIds: [], preview: initial as InkShape | null },
    };
  }
  if (tool === "eraser") {
    return {
      gesture: { kind: "erase", last: raw, erasedIds: [] },
      patch: { interacting: true, erasedIds: [], eraserCursor: screen },
    };
  }
  if (tool === "connector") {
    if (document.connectors.length >= MAX_CONNECTORS) return null;
    const start = endpointAt(
      document.shapes,
      {
        x: clamp(raw.x, -MAX_ENDPOINT_COORDINATE, MAX_ENDPOINT_COORDINATE),
        y: clamp(raw.y, -MAX_ENDPOINT_COORDINATE, MAX_ENDPOINT_COORDINATE),
      },
      10 / camera.zoom,
    );
    const id = makeId();
    return {
      gesture: { kind: "connect", id, start },
      patch: {
        selectedIds: [],
        interacting: true,
        activeEndpoint: "end",
        bindingTargetId: start.type === "binding" ? start.shapeId : null,
        connectorPreview: {
          id,
          type: "connector",
          start,
          end: start,
          color: "#243e33",
          arrowhead: "arrow",
        },
      },
    };
  }
  if (tool === "rectangle") {
    if (document.shapes.length >= MAX_SHAPES) return null;
    const start = {
      x: clamp(raw.x, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(raw.y, -MAX_COORDINATE, MAX_COORDINATE),
    };
    const id = makeId();
    return {
      gesture: { kind: "draw", start, id, shapeKind: snapshot.shapeKind },
      patch: {
        interacting: true,
        selectedIds: [],
        preview: rectangleBetween(id, start, start, fill, snapshot.shapeKind),
      },
    };
  }
  const object = hitSceneObject(document, raw, 7 / camera.zoom, true);
  const shape = object?.type === "connector" ? undefined : object;
  const edge = object?.type === "connector" ? object : undefined;
  const hitId = shape?.id ?? edge?.id;
  const hitIds = hitId ? expandGroups(document, [hitId]) : [];
  const locked = lockedObjectIds(document);
  const groupLocked = (ids: readonly string[]) => ids.some((id) => locked.has(id));
  if (additive && hitId)
    return {
      gesture: null,
      patch: {
        selectedIds: selectedIds.includes(hitId)
          ? selectedIds.filter((id) => !hitIds.includes(id))
          : [...new Set([...selectedIds, ...hitIds])],
      },
    };
  if (hitId && groupLocked(hitIds)) return { gesture: null, patch: { selectedIds: hitIds } };
  const movementIds = frameSelectionContents(document, selectedIds);
  const lockedSelection = groupLocked(selectedIds);
  const movementLocked = groupLocked(movementIds);
  const selectedShape = lockedSelection
    ? undefined
    : document.shapes.find((shape) => shape.id === selectedId);
  const connector = lockedSelection
    ? undefined
    : document.connectors.find((edge) => edge.id === selectedId);
  const endpoint = connector ? hitConnectorEnd(connector, document.shapes, screen, camera) : null;
  const bend =
    connector && !endpoint ? hitConnectorBend(connector, document.shapes, screen, camera) : null;
  if (bend && connector)
    return {
      gesture: {
        kind: "bend-connector",
        connector,
        start: raw,
        position: resolveConnector(connector, document.shapes).bend!.point[bend],
      },
      patch: { interacting: true, activeConnectorBend: bend, connectorPreview: connector },
    };
  const handle = selectedShape ? hitResizeHandle(selectedShape, screen, camera) : null;
  const connectionHandle =
    selectedShape && tool === "select" && !lockedSelection
      ? connectionHandleAt(selectedShape, screen, camera)
      : null;
  if (
    connectionHandle &&
    selectedShape?.type === "rectangle" &&
    selectedShape.kind !== "frame" &&
    document.connectors.length < MAX_CONNECTORS &&
    document.shapes.length < MAX_SHAPES
  ) {
    const shapeId = makeId();
    const id = makeId();
    const start = { type: "binding" as const, shapeId: selectedShape.id };
    return {
      gesture: { kind: "create-connected", id, shapeId, source: selectedShape, start },
      patch: {
        interacting: true,
        activeEndpoint: "end",
        connectorPreview: {
          id,
          type: "connector",
          start,
          end: start,
          color: "#243e33",
          arrowhead: "arrow",
        },
      },
    };
  }
  if (!hitId && (additive || !endpoint) && !handle)
    return {
      gesture: { kind: "marquee", start: raw, before: selectedIds, additive },
      patch: {
        selectedIds: additive ? selectedIds : [],
        marquee: { ...raw, width: 0, height: 0 },
        interacting: true,
      },
    };
  if (hitId && selectedIds.length > 1 && selectedIds.includes(hitId))
    return {
      gesture: movementLocked ? null : { kind: "move-selection", start: raw, ids: movementIds },
      patch: { interacting: !movementLocked },
    };
  if (endpoint && connector)
    return {
      gesture: { kind: "reconnect", connector, endpoint },
      patch: { interacting: true, activeEndpoint: endpoint, connectorPreview: connector },
    };
  if (handle && selectedShape)
    return {
      gesture: { kind: "resize", start: raw, shape: selectedShape, handle },
      patch: { interacting: true, activeHandle: handle },
    };
  const movable = Boolean(
    (shape || hitIds.length > 1 || (edge?.start.type === "point" && edge.end.type === "point")) &&
    !groupLocked(frameSelectionContents(document, hitIds)),
  );
  const ids = hitIds;
  return {
    gesture: movable
      ? { kind: "move-selection", start: raw, ids: frameSelectionContents(document, ids) }
      : null,
    patch: { selectedIds: ids, interacting: !!movable },
  };
}
