import { createConnectorResolver, translateObjects, expandGroups } from "@hydraw/document";
import type {
  BoardDocument,
  Bounds,
  Connector,
  ObjectUpdates,
  Point,
  Shape,
} from "@hydraw/document";
import { snapTranslation } from "./snapping.ts";
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
  const resolveConnector = createConnectorResolver(document.shapes);
  const lockedGroups = new Set(
    [...document.shapes, ...document.connectors]
      .filter((item) => item.locked && item.groupId)
      .map((item) => item.groupId),
  );
  const editable = (item: Shape | Connector) =>
    !item.locked && (!item.groupId || !lockedGroups.has(item.groupId));
  return expandGroups(document, [
    ...document.shapes
      .filter(
        (shape) =>
          editable(shape) &&
          contains(bounds, shape) &&
          contains(bounds, { x: shape.x + shape.width, y: shape.y + shape.height }),
      )
      .map((shape) => shape.id),
    ...document.connectors
      .filter((connector) => {
        const ends = resolveConnector(connector);
        return editable(connector) && ends.points.every((point) => contains(bounds, point));
      })
      .map((connector) => connector.id),
  ]);
}

export function previewSelectionGesture(
  gesture: SelectionGesture,
  screen: Point,
  camera: Camera,
  document: BoardDocument,
  snapping = true,
): Partial<EditorSnapshot> {
  const point = screenToWorld(screen, camera);
  if (gesture.kind === "move-selection") {
    const requested = { x: point.x - gesture.start.x, y: point.y - gesture.start.y };
    const dragging = Math.hypot(requested.x, requested.y) * camera.zoom >= 3;
    const snapped =
      snapping && dragging
        ? snapTranslation(document, gesture.ids, requested, camera.zoom)
        : { delta: requested, guides: [] };
    const updates = translateObjects(document, gesture.ids, snapped.delta);
    const originals = new Map(
      [...document.shapes, ...document.connectors].map((item) => [item.id, item]),
    );
    const near = (value: number, expected: number) => Math.abs(value - expected) < 0.000001;
    const clamped =
      updates.shapes.some((shape) => {
        const before = originals.get(shape.id) as Shape;
        return (
          !near(shape.x, before.x + snapped.delta.x) || !near(shape.y, before.y + snapped.delta.y)
        );
      }) ||
      updates.connectors.some((edge) => {
        const before = originals.get(edge.id) as Connector;
        return (["start", "end"] as const).some((key) => {
          const start = before[key],
            end = edge[key];
          return (
            start.type === "point" &&
            end.type === "point" &&
            (!near(end.x, start.x + snapped.delta.x) || !near(end.y, start.y + snapped.delta.y))
          );
        });
      });
    return { selectionPreview: updates, guides: clamped ? [] : snapped.guides };
  }
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
  const node =
    (snapshot.textEditing?.ownerId ? null : snapshot.textEditing?.draft) ?? snapshot.preview;
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
  const erased = new Set(snapshot.erasedIds);
  return {
    shapes: shapes.filter((shape) => !erased.has(shape.id)),
    connectors: connectors.filter(
      (edge) =>
        !erased.has(edge.id) &&
        !(edge.start.type === "binding" && erased.has(edge.start.shapeId)) &&
        !(edge.end.type === "binding" && erased.has(edge.end.shapeId)),
    ),
  };
}

export { selectionBounds } from "./selection-bounds.ts";
