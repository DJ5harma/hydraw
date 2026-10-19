import { resolveConnector, translateObjects } from "@hydraw/document";
import type {
  BoardDocument,
  Bounds,
  Connector,
  ObjectUpdates,
  Point,
  Shape,
} from "@hydraw/document";
import { screenToWorld } from "./geometry.ts";
import type { Camera, EditorSnapshot } from "./types.ts";

export type SelectionGesture =
  | Readonly<{ kind: "move-selection"; start: Point; ids: readonly string[] }>
  | Readonly<{ kind: "marquee"; start: Point; before: readonly string[]; additive: boolean }>;

export function objectIds(document: BoardDocument): readonly string[] {
  return [
    ...document.shapes.map((shape) => shape.id),
    ...document.connectors.map((connector) => connector.id),
  ];
}

function contains(bounds: Bounds, point: Point): boolean {
  return (
    point.x >= bounds.x &&
    point.y >= bounds.y &&
    point.x <= bounds.x + bounds.width &&
    point.y <= bounds.y + bounds.height
  );
}

export function enclosedObjects(document: BoardDocument, bounds: Bounds): readonly string[] {
  return [
    ...document.shapes
      .filter(
        (shape) =>
          contains(bounds, shape) &&
          contains(bounds, { x: shape.x + shape.width, y: shape.y + shape.height }),
      )
      .map((shape) => shape.id),
    ...document.connectors
      .filter((connector) => {
        const ends = resolveConnector(connector, document.shapes);
        return contains(bounds, ends.start) && contains(bounds, ends.end);
      })
      .map((connector) => connector.id),
  ];
}

export function previewSelectionGesture(
  gesture: SelectionGesture,
  screen: Point,
  camera: Camera,
  document: BoardDocument,
): Partial<EditorSnapshot> {
  const point = screenToWorld(screen, camera);
  if (gesture.kind === "move-selection")
    return {
      selectionPreview: translateObjects(document, gesture.ids, {
        x: point.x - gesture.start.x,
        y: point.y - gesture.start.y,
      }),
    };
  const marquee = {
    x: Math.min(point.x, gesture.start.x),
    y: Math.min(point.y, gesture.start.y),
    width: Math.abs(point.x - gesture.start.x),
    height: Math.abs(point.y - gesture.start.y),
  };
  const enclosed = enclosedObjects(document, marquee);
  return {
    marquee,
    selectedIds: gesture.additive ? [...new Set([...gesture.before, ...enclosed])] : enclosed,
  };
}

/** Merge transient records for rendering and selection bounds without changing persisted records. */
export function selectionScene(snapshot: EditorSnapshot): ObjectUpdates {
  const shapeUpdates = new Map(snapshot.selectionPreview?.shapes.map((shape) => [shape.id, shape]));
  const node = snapshot.textEditing?.draft ?? snapshot.preview;
  if (node) shapeUpdates.set(node.id, node);
  const connectorUpdates = new Map(
    snapshot.selectionPreview?.connectors.map((connector) => [connector.id, connector]),
  );
  if (snapshot.connectorPreview)
    connectorUpdates.set(snapshot.connectorPreview.id, snapshot.connectorPreview);
  const shapes = snapshot.document.shapes.map((shape) => shapeUpdates.get(shape.id) ?? shape);
  if (node && !snapshot.document.shapes.some((shape) => shape.id === node.id)) shapes.push(node);
  const connectors = snapshot.document.connectors.map(
    (connector) => connectorUpdates.get(connector.id) ?? connector,
  );
  if (
    snapshot.connectorPreview &&
    !snapshot.document.connectors.some(
      (connector) => connector.id === snapshot.connectorPreview!.id,
    )
  )
    connectors.push(snapshot.connectorPreview);
  return { shapes, connectors };
}

export function selectionBounds(
  shapes: readonly Shape[],
  connectors: readonly Connector[],
  ids: readonly string[],
): Bounds | null {
  const selected = new Set(ids);
  const points: Point[] = [];
  for (const shape of shapes)
    if (selected.has(shape.id))
      points.push(shape, { x: shape.x + shape.width, y: shape.y + shape.height });
  for (const connector of connectors)
    if (selected.has(connector.id)) {
      const ends = resolveConnector(connector, shapes);
      points.push(ends.start, ends.end);
    }
  if (!points.length) return null;
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
