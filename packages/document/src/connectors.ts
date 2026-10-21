import type { Connector, Endpoint, Point, Shape } from "./model.ts";

function center(shape: Shape): Point {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

type ResolvedEndpoint = Point | Shape;
export type ConnectorGeometry = Readonly<{ start: Point; end: Point }>;
export type ConnectorResolver = (connector: Connector) => ConnectorGeometry;

function perimeter(endpoint: ResolvedEndpoint, toward: Point, fallback: number): Point {
  if (!("width" in endpoint)) return endpoint;
  const origin = center(endpoint);
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  if (dx === 0 && dy === 0) return { x: origin.x + (fallback * endpoint.width) / 2, y: origin.y };
  const nx = Math.abs(dx) / (endpoint.width / 2),
    ny = Math.abs(dy) / (endpoint.height / 2);
  const scale =
    1 /
    (endpoint.type === "rectangle" && endpoint.kind === "ellipse"
      ? Math.hypot(nx, ny)
      : endpoint.type === "rectangle" && endpoint.kind === "diamond"
        ? nx + ny
        : Math.max(nx, ny));
  return { x: origin.x + dx * scale, y: origin.y + dy * scale };
}

function resolve(connector: Connector, find: (id: string) => Shape | undefined): ConnectorGeometry {
  function endpoint(value: Endpoint): ResolvedEndpoint {
    if (value.type === "point") return { x: value.x, y: value.y };
    const shape = find(value.shapeId);
    if (!shape) throw new Error("A connector refers to a missing object.");
    return shape;
  }
  const start = endpoint(connector.start);
  const end = endpoint(connector.end);
  return {
    start: perimeter(start, "width" in end ? center(end) : end, 1),
    end: perimeter(end, "width" in start ? center(start) : start, -1),
  };
}

/** Resolve a single edge against current node bounds, including transient previews. */
export function resolveConnector(
  connector: Connector,
  shapes: readonly Shape[],
): ConnectorGeometry {
  return resolve(connector, (id) => shapes.find((shape) => shape.id === id));
}

/** Index a scene once when resolving many edges. The index is derived, never persisted. */
export function createConnectorResolver(shapes: readonly Shape[]): ConnectorResolver {
  const index = new Map(shapes.map((shape) => [shape.id, shape]));
  return (connector) => resolve(connector, (id) => index.get(id));
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
