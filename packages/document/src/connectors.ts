import { MAX_ENDPOINT_COORDINATE } from "./model.ts";
import type { Connector, Endpoint, Point, Shape } from "./model.ts";

function center(shape: Shape): Point {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

type ResolvedEndpoint = Point | Shape;
export type ConnectorGeometry = Readonly<{
  start: Point;
  end: Point;
  points: readonly Point[];
  bend?: Readonly<{ axis: "x" | "y"; point: Point }>;
}>;
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

/** Keep the trunk outside endpoint bodies. Other scene objects are not routing obstacles. */
function safeTrunk(requested: number, axis: "x" | "y", endpoints: ResolvedEndpoint[]): number {
  const intervals = endpoints
    .filter((item): item is Shape => "width" in item)
    .map(
      (shape) =>
        [shape[axis] - 16, shape[axis] + (axis === "x" ? shape.width : shape.height) + 16] as const,
    )
    .toSorted((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  const candidate = Math.max(
    -MAX_ENDPOINT_COORDINATE,
    Math.min(MAX_ENDPOINT_COORDINATE, requested),
  );
  const blocked = merged.find(([min, max]) => candidate > min && candidate < max);
  return blocked
    ? candidate - blocked[0] < blocked[1] - candidate
      ? blocked[0]
      : blocked[1]
    : candidate;
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
  if (connector.route) {
    const { axis, position } = connector.route;
    const first = "width" in start ? center(start) : start;
    const last = "width" in end ? center(end) : end;
    const requested = position ?? (first[axis] + last[axis]) / 2;
    const trunk = safeTrunk(requested, axis, [start, end]);
    const target = (point: Point): Point =>
      axis === "x" ? { x: trunk, y: point.y } : { x: point.x, y: trunk };
    const from = perimeter(start, target(first), 1);
    const to = perimeter(end, target(last), -1);
    const middle =
      axis === "x" ? { x: trunk, y: (from.y + to.y) / 2 } : { x: (from.x + to.x) / 2, y: trunk };
    const points = [from, target(from), target(to), to].filter(
      (point, index, all) =>
        index === 0 || point.x !== all[index - 1]!.x || point.y !== all[index - 1]!.y,
    );
    // Coincident free endpoints still expose a valid zero-length path.
    if (points.length === 1) points.push(to);
    return { start: from, end: to, points, bend: { axis, point: middle } };
  }
  const from = perimeter(start, "width" in end ? center(end) : end, 1);
  const to = perimeter(end, "width" in start ? center(start) : start, -1);
  return { start: from, end: to, points: [from, to] };
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

/** A caption follows the midpoint by travelled path length, including edited bends. */
export function connectorMidpoint(geometry: ConnectorGeometry): Point {
  const { points } = geometry;
  const lengths = points
    .slice(1)
    .map((point, i) => Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (remaining <= length && length > 0) {
      const from = points[i]!,
        to = points[i + 1]!;
      return {
        x: from.x + ((to.x - from.x) * remaining) / length,
        y: from.y + ((to.y - from.y) * remaining) / length,
      };
    }
    remaining -= length;
  }
  return geometry.start;
}

/** Detaching external bindings preserves the routed silhouette, including an automatic trunk. */
export function detachConnectorBindings(
  connector: Connector,
  shapes: readonly Shape[],
  keep: ReadonlySet<string> = new Set(),
): Connector {
  const geometry = resolveConnector(connector, shapes);
  let changed = false;
  const endpoint = (key: "start" | "end"): Endpoint => {
    const value = connector[key];
    if (value.type !== "binding" || keep.has(value.shapeId)) return value;
    changed = true;
    return { type: "point", ...geometry[key] };
  };
  const start = endpoint("start"),
    end = endpoint("end");
  return changed
    ? {
        ...connector,
        start,
        end,
        ...(connector.route && geometry.bend
          ? { route: { ...connector.route, position: geometry.bend.point[connector.route.axis] } }
          : {}),
      }
    : connector;
}
