import { MAX_COORDINATE, MAX_SIZE } from "@hydraw/document";
import type { Point, Bounds, Shape } from "@hydraw/document";
import type { Camera } from "./types.ts";

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function screenToWorld(point: Point, camera: Camera): Point {
  return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
}

export const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

export function handlePoint(shape: Bounds, handle: ResizeHandle): Point {
  return {
    x: shape.x + (handle.includes("w") ? 0 : handle.includes("e") ? shape.width : shape.width / 2),
    y:
      shape.y + (handle.includes("n") ? 0 : handle.includes("s") ? shape.height : shape.height / 2),
  };
}

export function hitResizeHandle(shape: Shape, screen: Point, camera: Camera): ResizeHandle | null {
  let closest: ResizeHandle | null = null;
  let distance = Infinity;
  for (const handle of resizeHandles(shape)) {
    const point = handlePoint(shape, handle);
    const dx = point.x * camera.zoom + camera.x - screen.x;
    const dy = point.y * camera.zoom + camera.y - screen.y;
    if (Math.abs(dx) <= 7 && Math.abs(dy) <= 7 && dx * dx + dy * dy < distance) {
      closest = handle;
      distance = dx * dx + dy * dy;
    }
  }
  return closest;
}

function resizeAxis(
  anchor: number,
  value: number,
): { position: number; size: number; moving: number } {
  const moving = clamp(
    value,
    Math.max(-MAX_COORDINATE, anchor - MAX_SIZE),
    anchor > MAX_COORDINATE ? MAX_COORDINATE : anchor + MAX_SIZE,
  );
  return {
    position: Math.min(anchor, moving),
    size: Math.max(1, Math.abs(moving - anchor)),
    moving,
  };
}

/** The opposite edge remains anchored. Crossing it normalizes geometry instead of producing negative dimensions. */
export function resizeRectangle<T extends Bounds>(shape: T, handle: ResizeHandle, point: Point): T {
  const x =
    handle.includes("w") || handle.includes("e")
      ? resizeAxis(handle.includes("w") ? shape.x + shape.width : shape.x, point.x)
      : { position: shape.x, size: shape.width };
  const y =
    handle.includes("n") || handle.includes("s")
      ? resizeAxis(handle.includes("n") ? shape.y + shape.height : shape.y, point.y)
      : { position: shape.y, size: shape.height };
  return { ...shape, x: x.position, y: y.position, width: x.size, height: y.size };
}

function crossedAxes(shape: Bounds, handle: ResizeHandle, point: Point) {
  const anchorX = handle.includes("w") ? shape.x + shape.width : shape.x;
  const anchorY = handle.includes("n") ? shape.y + shape.height : shape.y;
  const movingX = resizeAxis(anchorX, point.x).moving;
  const movingY = resizeAxis(anchorY, point.y).moving;
  return {
    x: (handle.includes("e") && movingX < anchorX) || (handle.includes("w") && movingX > anchorX),
    y: (handle.includes("s") && movingY < anchorY) || (handle.includes("n") && movingY > anchorY),
  };
}

/** Reflect asymmetric content when a resize crosses the fixed opposite edge. */
export function resizeShape(shape: Shape, handle: ResizeHandle, point: Point): Shape {
  const bounds = resizeRectangle(shape, handle, point);
  const crossed = crossedAxes(shape, handle, point);
  if (shape.type === "ink" && (crossed.x || crossed.y))
    return {
      ...shape,
      ...bounds,
      type: "ink",
      points: shape.points.map((point) => ({
        x: crossed.x ? 1 - point.x : point.x,
        y: crossed.y ? 1 - point.y : point.y,
      })),
    };
  return bounds;
}

export function resizedHandle(shape: Bounds, handle: ResizeHandle, point: Point): ResizeHandle {
  const crossed = crossedAxes(shape, handle, point);
  return handle.replace(/[ewns]/g, (edge) =>
    crossed.x && (edge === "e" || edge === "w")
      ? edge === "e"
        ? "w"
        : "e"
      : crossed.y && (edge === "n" || edge === "s")
        ? edge === "n"
          ? "s"
          : "n"
        : edge,
  ) as ResizeHandle;
}

export function resizeHandles(shape: Shape): readonly ResizeHandle[] {
  return shape.type === "text" ? ["e", "w"] : RESIZE_HANDLES;
}
