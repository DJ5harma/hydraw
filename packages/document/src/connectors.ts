import type { Connector, Endpoint, Point, Shape } from "./model.ts";

function center(shape: Shape): Point {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

function seed(endpoint: Endpoint, shapes: readonly Shape[]): Point {
  if (endpoint.type === "point") return endpoint;
  const shape = shapes.find((shape) => shape.id === endpoint.shapeId);
  if (!shape) throw new Error("A connector refers to a missing object.");
  return center(shape);
}

function perimeter(
  endpoint: Endpoint,
  toward: Point,
  shapes: readonly Shape[],
  fallback: number,
): Point {
  if (endpoint.type === "point") return { x: endpoint.x, y: endpoint.y };
  const shape = shapes.find((shape) => shape.id === endpoint.shapeId);
  if (!shape) throw new Error("A connector refers to a missing object.");
  const origin = center(shape);
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  if (dx === 0 && dy === 0) return { x: origin.x + (fallback * shape.width) / 2, y: origin.y };
  const scale = 1 / Math.max(Math.abs(dx) / (shape.width / 2), Math.abs(dy) / (shape.height / 2));
  return { x: origin.x + dx * scale, y: origin.y + dy * scale };
}

/** Endpoints are derived from current node bounds, including temporary move/resize previews. */
export function resolveConnector(
  connector: Connector,
  shapes: readonly Shape[],
): Readonly<{ start: Point; end: Point }> {
  return {
    start: perimeter(connector.start, seed(connector.end, shapes), shapes, 1),
    end: perimeter(connector.end, seed(connector.start, shapes), shapes, -1),
  };
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
        );
  return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
}
