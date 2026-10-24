import type { InkShape, Point } from "@hydraw/document";

export const ERASER_RADIUS_SCREEN = 12;

function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

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
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
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
  if (path.length === 1) return pointToSegmentDistance(path[0]!, from, to) <= threshold;
  for (let index = 1; index < path.length; index++) {
    if (segmentDistance(from, to, path[index - 1]!, path[index]!) <= threshold) return true;
  }
  return false;
}
