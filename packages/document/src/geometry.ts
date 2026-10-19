import type { Fill, Point, Rectangle, Shape } from "./model.ts";

export function rectangleBetween(id: string, a: Point, b: Point, fill: Fill): Rectangle {
  return {
    id,
    type: "rectangle",
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
    fill,
  };
}

export function hitTest(shapes: readonly Shape[], point: Point): Shape | undefined {
  return shapes.findLast(
    (shape) =>
      point.x >= shape.x &&
      point.x <= shape.x + shape.width &&
      point.y >= shape.y &&
      point.y <= shape.y + shape.height,
  );
}
