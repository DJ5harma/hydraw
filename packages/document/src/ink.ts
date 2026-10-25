import { distanceToSegment } from "./math.ts";
import {
  MAX_COORDINATE,
  MAX_SIZE,
  type ObjectMetadata,
  type Point,
  type Rectangle,
  type TextColor,
} from "./model.ts";

/** A freehand path stored in unit coordinates relative to its world-space bounds. */
export type InkShape = Readonly<{
  id: string;
  type: "ink";
  x: number;
  y: number;
  width: number;
  height: number;
  points: readonly Point[];
  color: TextColor;
  strokeWidth: number;
}> &
  ObjectMetadata;

export const MAX_INK_POINTS = 4_096;

/** Convert world samples to bounded local coordinates, retaining sharp turns when reducing. */
export function makeInkShape(
  id: string,
  worldPoints: readonly Point[],
  color: TextColor,
  strokeWidth: number,
): InkShape | null {
  if (
    !id ||
    !Number.isFinite(strokeWidth) ||
    strokeWidth <= 0 ||
    worldPoints.length === 0 ||
    worldPoints.length > 1_000_000
  )
    return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const point of worldPoints) {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      Math.abs(point.x) > MAX_COORDINATE ||
      Math.abs(point.y) > MAX_COORDINATE
    )
      return null;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const rawWidth = maxX - minX,
    rawHeight = maxY - minY;
  if (rawWidth > MAX_SIZE || rawHeight > MAX_SIZE) return null;
  const width = Math.max(rawWidth, 1),
    height = Math.max(rawHeight, 1);
  const kept = simplifyInkPoints(worldPoints);
  const points = kept.map((point) => ({
    x: rawWidth === 0 ? 0 : Math.min(1, Math.max(0, (point.x - minX) / width)),
    y: rawHeight === 0 ? 0 : Math.min(1, Math.max(0, (point.y - minY) / height)),
  }));
  return { id, type: "ink", x: minX, y: minY, width, height, points, color, strokeWidth };
}

export function simplifyInkPoints(points: readonly Point[]): readonly Point[] {
  if (points.length <= MAX_INK_POINTS) return points;
  const turns = points.map((point, i) => {
    if (i === 0 || i === points.length - 1) return { i, score: Infinity };
    const a = points[i - 1]!,
      b = point,
      c = points[i + 1]!;
    const ab = Math.hypot(b.x - a.x, b.y - a.y),
      bc = Math.hypot(c.x - b.x, c.y - b.y);
    if (ab === 0 || bc === 0) return { i, score: 0 };
    const dot = ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (ab * bc);
    return { i, score: 1 - Math.max(-1, Math.min(1, dot)) };
  });
  const selected = new Set<number>([0, points.length - 1]);
  for (const { i } of turns
    .toSorted((a, b) => b.score - a.score)
    .slice(0, Math.floor(MAX_INK_POINTS / 4)))
    selected.add(i);
  const target = MAX_INK_POINTS - selected.size;
  for (let i = 0; i < target; i++)
    selected.add(Math.round((i * (points.length - 1)) / Math.max(1, target - 1)));
  if (selected.size < MAX_INK_POINTS) {
    for (let i = 1; selected.size < MAX_INK_POINTS && i < points.length - 1; i++) selected.add(i);
  }
  return [...selected]
    .toSorted((a, b) => a - b)
    .slice(0, MAX_INK_POINTS)
    .map((i) => points[i]!);
}

/** Polyline hit test in world coordinates, including stroke radius and caller tolerance. */
export function hitTestInk(shape: InkShape, point: Point, tolerance = 0): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || tolerance < 0) return false;
  const path = shape.points.map(({ x, y }) => ({
    x: shape.x + x * shape.width,
    y: shape.y + y * shape.height,
  }));
  const radius = shape.strokeWidth / 2 + tolerance;
  if (path.length === 1) return Math.hypot(point.x - path[0]!.x, point.y - path[0]!.y) <= radius;
  for (let i = 1; i < path.length; i++)
    if (distanceToSegment(point, path[i - 1]!, path[i]!) <= radius) return true;
  return false;
}

function closedEnough(path: readonly Point[], diagonal: number): boolean {
  return (
    path.length >= 8 &&
    Math.hypot(path[0]!.x - path.at(-1)!.x, path[0]!.y - path.at(-1)!.y) <= diagonal * 0.18
  );
}

/** Recognize a clean, roughly closed axis-aligned rectangle or ellipse. */
export function recognizeInk(shape: InkShape): Rectangle | null {
  if (shape.points.length < 8 || shape.width <= 0 || shape.height <= 0) return null;
  const path = shape.points.map(({ x, y }) => ({ x: x * shape.width, y: y * shape.height }));
  const diagonal = Math.hypot(shape.width, shape.height);
  if (!closedEnough(path, diagonal)) return null;
  const rectError =
    path.reduce((sum, p) => sum + Math.min(p.x, shape.width - p.x, p.y, shape.height - p.y), 0) /
    path.length;
  const ellipseError =
    path.reduce((sum, p) => {
      const nx = (p.x - shape.width / 2) / (shape.width / 2);
      const ny = (p.y - shape.height / 2) / (shape.height / 2);
      return sum + (Math.abs(Math.hypot(nx, ny) - 1) * diagonal) / 2;
    }, 0) / path.length;
  const limit = diagonal * 0.1;
  const cornerCoverage = [
    path.some((p) => Math.hypot(p.x, p.y) <= diagonal * 0.18),
    path.some((p) => Math.hypot(shape.width - p.x, p.y) <= diagonal * 0.18),
    path.some((p) => Math.hypot(p.x, shape.height - p.y) <= diagonal * 0.18),
    path.some((p) => Math.hypot(shape.width - p.x, shape.height - p.y) <= diagonal * 0.18),
  ].every(Boolean);
  const angleBins = new Set(
    path.map(
      (p) =>
        Math.floor(
          ((Math.atan2(p.y - shape.height / 2, p.x - shape.width / 2) + Math.PI) / (Math.PI * 2)) *
            12,
        ) % 12,
    ),
  );
  let kind: "rectangle" | "ellipse";
  if (cornerCoverage && rectError <= limit && rectError * 1.15 < ellipseError) kind = "rectangle";
  else if (angleBins.size >= 10 && ellipseError <= limit && ellipseError * 1.15 < rectError)
    kind = "ellipse";
  else return null;
  return {
    id: shape.id,
    type: "rectangle",
    ...(shape.groupId ? { groupId: shape.groupId } : {}),
    ...(shape.locked !== undefined ? { locked: shape.locked } : {}),
    ...(shape.zIndex !== undefined ? { zIndex: shape.zIndex } : {}),
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    fill: "transparent",
    appearance: {
      stroke: shape.color,
      strokeWidth: shape.strokeWidth,
      strokeStyle: "solid",
      opacity: 100,
      cornerRadius: 0,
    },
    ...(kind === "ellipse" ? { kind } : {}),
  };
}
