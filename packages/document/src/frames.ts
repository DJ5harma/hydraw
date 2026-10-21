import { rectangleAppearance } from "./appearance.ts";
import { createConnectorResolver } from "./connectors.ts";
import { MAX_COORDINATE, MAX_SHAPES, MAX_SIZE } from "./model.ts";
import type { BoardDocument, Point, Rectangle, Shape } from "./model.ts";
import { shapeTransaction } from "./transactions.ts";
import type { DocumentTransaction } from "./transactions.ts";

export function isFrame(shape: Shape): shape is Rectangle & { kind: "frame" } {
  return shape.type === "rectangle" && shape.kind === "frame";
}

function contains(frame: Rectangle, point: Point): boolean {
  return (
    point.x >= frame.x &&
    point.x <= frame.x + frame.width &&
    point.y >= frame.y &&
    point.y <= frame.y + frame.height
  );
}
function within(frame: Rectangle, shape: Shape): boolean {
  return (
    shape.x >= frame.x &&
    shape.y >= frame.y &&
    shape.x + shape.width <= frame.x + frame.width &&
    shape.y + shape.height <= frame.y + frame.height
  );
}

/** IDs fully contained in a frame. Groups are included only when every member fits. */
export function frameContents(document: BoardDocument, frameId: string): readonly string[] {
  const frame = document.shapes.find((shape) => shape.id === frameId && isFrame(shape));
  if (!frame || !isFrame(frame)) return [];
  const candidates = new Set(
    document.shapes
      .filter((shape) => !isFrame(shape) && within(frame, shape))
      .map((shape) => shape.id),
  );
  const groupMembers = new Map<string, string[]>();
  for (const object of [...document.shapes, ...document.connectors])
    if (object.groupId)
      groupMembers.set(object.groupId, [...(groupMembers.get(object.groupId) ?? []), object.id]);
  const resolver = createConnectorResolver(document.shapes);
  const containedConnectors = new Set<string>();
  for (const connector of document.connectors) {
    const geometry = resolver(connector);
    if (contains(frame, geometry.start) && contains(frame, geometry.end))
      containedConnectors.add(connector.id);
  }
  const result = new Set(candidates);
  for (const connector of containedConnectors) result.add(connector);
  for (const members of groupMembers.values()) {
    const contained = members.every((id) => candidates.has(id) || containedConnectors.has(id));
    if (contained) for (const id of members) result.add(id);
    else {
      for (const id of members)
        if (candidates.has(id) || containedConnectors.has(id)) result.delete(id);
    }
  }
  return Object.freeze([...result]);
}

/** Adds frame contents to a movement set; ordinary selection remains unchanged. */
export function frameSelectionContents(
  document: BoardDocument,
  ids: readonly string[],
): readonly string[] {
  const expanded = new Set(ids);
  for (const id of ids) {
    const frame = document.shapes.find((shape) => shape.id === id && isFrame(shape));
    if (frame) for (const contentId of frameContents(document, id)) expanded.add(contentId);
  }
  return Object.freeze([...expanded]);
}

export function createFrameAroundSelection(
  document: BoardDocument,
  ids: readonly string[],
  makeId: () => string,
): Readonly<{ transaction: DocumentTransaction | null; id: string | null }> {
  const selected = new Set(ids);
  const shapes = document.shapes.filter((shape) => selected.has(shape.id) && !isFrame(shape));
  const connectors = document.connectors.filter((connector) => selected.has(connector.id));
  if (!shapes.length && !connectors.length) return { transaction: null, id: null };
  const resolver = createConnectorResolver(document.shapes);
  const points: Point[] = [];
  for (const shape of shapes)
    points.push(
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.width, y: shape.y + shape.height },
    );
  for (const connector of connectors) {
    const geometry = resolver(connector);
    points.push(geometry.start, geometry.end);
  }
  const minX = Math.min(...points.map((point) => point.x)) - 32;
  const minY = Math.min(...points.map((point) => point.y)) - 32;
  const maxX = Math.max(...points.map((point) => point.x)) + 32;
  const maxY = Math.max(...points.map((point) => point.y)) + 32;
  if (
    minX < -MAX_COORDINATE ||
    minY < -MAX_COORDINATE ||
    maxX > MAX_COORDINATE ||
    maxY > MAX_COORDINATE ||
    maxX - minX > MAX_SIZE ||
    maxY - minY > MAX_SIZE
  )
    throw new Error("This selection is too large or close to the board boundary to frame.");
  if (document.shapes.length >= MAX_SHAPES)
    throw new Error("This board has no room for another shape.");
  const id = makeId();
  if (
    !id ||
    id.length > 100 ||
    [...document.shapes, ...document.connectors].some(
      (item) => item.id === id || item.groupId === id,
    )
  )
    throw new Error("Could not create a unique frame identity.");
  const zIndex = Math.max(
    -1_000_000_000,
    Math.min(0, ...[...document.shapes, ...document.connectors].map((item) => item.zIndex ?? 0)) -
      1,
  );
  const labelNumber = document.shapes.filter(isFrame).length + 1;
  const frame: Rectangle = {
    id,
    type: "rectangle",
    kind: "frame",
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    fill: "transparent",
    zIndex,
    appearance: {
      ...rectangleAppearance({}),
      stroke: "#3568db",
      strokeWidth: 1.5,
      strokeStyle: "solid",
      opacity: 100,
      cornerRadius: 4,
    },
    label: { text: `Frame ${labelNumber}`, fontSize: 20, fontWeight: 700, color: "#202124" },
  };
  const change = shapeTransaction("Create frame", document.shapes.length, null, frame)!;
  return { transaction: change, id };
}
