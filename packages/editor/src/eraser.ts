import {
  containsShape,
  createConnectorResolver,
  rectangleAppearance,
  lockedObjectIds,
  distanceToSegment,
} from "@hydraw/document";
import type { BoardDocument, InkShape, Point, Shape } from "@hydraw/document";

export const ERASER_RADIUS_SCREEN = 12;

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  const onSegment = (start: Point, point: Point, end: Point) =>
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y);
  if (abC === 0 && onSegment(a, c, b)) return true;
  if (abD === 0 && onSegment(a, d, b)) return true;
  if (cdA === 0 && onSegment(c, a, d)) return true;
  if (cdB === 0 && onSegment(c, b, d)) return true;
  return abC * abD < 0 && cdA * cdB < 0;
}

function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distanceToSegment(a, c, d),
    distanceToSegment(b, c, d),
    distanceToSegment(c, a, b),
    distanceToSegment(d, a, b),
  );
}

/** Test the swept eraser capsule against the full ink polyline in world coordinates. */
export function hitInkStroke(shape: InkShape, from: Point, to: Point, radius: number): boolean {
  if (!Number.isFinite(radius) || radius < 0) return false;
  const path = shape.points.map(({ x, y }) => ({
    x: shape.x + x * shape.width,
    y: shape.y + y * shape.height,
  }));
  const threshold = radius + shape.strokeWidth / 2;
  if (path.length === 1) return distanceToSegment(path[0]!, from, to) <= threshold;
  for (let index = 1; index < path.length; index++) {
    if (segmentDistance(from, to, path[index - 1]!, path[index]!) <= threshold) return true;
  }
  return false;
}

/** Match object bodies, while frames erase only at their border. */
export function hitEraserShape(shape: Shape, from: Point, to: Point, radius: number): boolean {
  const stroke =
    shape.type === "ink"
      ? shape.strokeWidth
      : shape.type === "rectangle"
        ? rectangleAppearance(shape).strokeWidth
        : 0;
  const padding = radius + stroke / 2;
  if (
    Math.max(from.x, to.x) + padding < shape.x ||
    Math.min(from.x, to.x) - padding > shape.x + shape.width ||
    Math.max(from.y, to.y) + padding < shape.y ||
    Math.min(from.y, to.y) - padding > shape.y + shape.height
  )
    return false;
  if (shape.type === "ink") return hitInkStroke(shape, from, to, radius);
  const frame = shape.type === "rectangle" && shape.kind === "frame";
  if (!frame && (containsShape(shape, from) || containsShape(shape, to))) return true;
  const { x, y, width: w, height: h } = shape;
  let path: Point[];
  if (shape.type === "rectangle" && shape.kind === "ellipse") {
    // Bound the polygon's deviation to a fraction of the eraser radius.
    const count = Math.min(
      4096,
      Math.max(32, Math.ceil(Math.PI * Math.sqrt(Math.max(w, h) / Math.max(radius / 4, 0.001)))),
    );
    path = Array.from({ length: count }, (_, i) => ({
      x: x + w / 2 + (Math.cos((i * 2 * Math.PI) / count) * w) / 2,
      y: y + h / 2 + (Math.sin((i * 2 * Math.PI) / count) * h) / 2,
    }));
  } else if (shape.type === "rectangle" && shape.kind === "diamond") {
    path = [
      { x: x + w / 2, y },
      { x: x + w, y: y + h / 2 },
      { x: x + w / 2, y: y + h },
      { x, y: y + h / 2 },
    ];
  } else {
    path = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  const threshold =
    radius + (shape.type === "rectangle" ? rectangleAppearance(shape).strokeWidth / 2 : 0);
  return path.some(
    (a, i) => segmentDistance(from, to, a, path[(i + 1) % path.length]!) <= threshold,
  );
}

/** Collect editable objects crossed by a sweep, independent of input and history. */
export function erasedObjects(
  document: BoardDocument,
  from: Point,
  to: Point,
  radius: number,
): string[] {
  const objects = [...document.shapes, ...document.connectors];
  const locked = lockedObjectIds(document);
  // Deleting a node also deletes its bindings; keep protected edges intact.
  const protectedBindings = new Set(
    document.connectors
      .filter((object) => locked.has(object.id))
      .flatMap((edge) =>
        [edge.start, edge.end].flatMap((end) => (end.type === "binding" ? [end.shapeId] : [])),
      ),
  );
  const resolve = createConnectorResolver(document.shapes);
  return objects
    .filter((item) => {
      if (locked.has(item.id) || protectedBindings.has(item.id)) return false;
      if (item.type !== "connector") return hitEraserShape(item, from, to, radius);
      const ends = resolve(item);
      return ends.points
        .slice(1)
        .some((point, i) => segmentDistance(from, to, ends.points[i]!, point) <= radius + 1);
    })
    .map((item) => item.id);
}
