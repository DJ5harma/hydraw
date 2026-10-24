import { createConnectorResolver } from "@hydraw/document";
import type { Shape, Connector, Bounds, Point } from "@hydraw/document";

export function selectionBounds(
  shapes: readonly Shape[],
  connectors: readonly Connector[],
  ids: readonly string[],
): Bounds | null {
  const selected = new Set(ids);
  const resolveConnector = createConnectorResolver(shapes);
  const points: Point[] = [];
  for (const shape of shapes)
    if (selected.has(shape.id))
      points.push(shape, { x: shape.x + shape.width, y: shape.y + shape.height });
  for (const connector of connectors)
    if (selected.has(connector.id)) {
      const ends = resolveConnector(connector);
      points.push(...ends.points);
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
