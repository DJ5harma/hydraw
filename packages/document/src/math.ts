import type { Point } from "./model.ts";

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Distance to a finite segment, including a zero-length segment. */
export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio =
    lengthSquared === 0
      ? 0
      : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
}
