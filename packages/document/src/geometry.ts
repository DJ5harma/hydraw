import { hitTestInk } from "./ink.ts";
import type { Fill, Point, Rectangle, Shape, ShapeKind } from "./model.ts";

export function rectangleBetween(
  id: string,
  a: Point,
  b: Point,
  fill: Fill,
  kind: ShapeKind = "rectangle",
): Rectangle {
  return {
    id,
    type: "rectangle",
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
    fill,
    ...(kind === "rectangle" ? {} : { kind }),
  };
}

export function containsShape(shape: Shape, point: Point, tolerance = 0): boolean {
  if (shape.type === "ink") return hitTestInk(shape, point, tolerance);
  const nx = Math.abs(point.x - shape.x - shape.width / 2) / (shape.width / 2 + tolerance);
  const ny = Math.abs(point.y - shape.y - shape.height / 2) / (shape.height / 2 + tolerance);
  if (shape.type === "rectangle" && shape.kind === "ellipse") return nx * nx + ny * ny <= 1;
  if (shape.type === "rectangle" && shape.kind === "diamond") return nx + ny <= 1;
  return nx <= 1 && ny <= 1;
}
export function hitTest(shapes: readonly Shape[], point: Point): Shape | undefined {
  return shapes
    .toSorted((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .findLast((shape) => containsShape(shape, point));
}
