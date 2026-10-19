import { MAX_COORDINATE } from "./model.ts";
import type { BoardDocument, Shape } from "./model.ts";
import { updateObjectsTransaction } from "./selection-operations.ts";
import type { DocumentTransaction } from "./transactions.ts";

export type Alignment =
  | "left"
  | "horizontal-center"
  | "right"
  | "top"
  | "vertical-center"
  | "bottom";
export type DistributionAxis = "horizontal" | "vertical";

function selectedShapes(document: BoardDocument, ids: readonly string[]): readonly Shape[] {
  const selected = new Set(ids);
  return document.shapes.filter((shape) => selected.has(shape.id));
}

function arrangement(
  document: BoardDocument,
  label: string,
  shapes: readonly Shape[],
): DocumentTransaction | null {
  const originals = new Map(document.shapes.map((shape) => [shape.id, shape]));
  const updates = shapes.map((shape) => {
    const before = originals.get(shape.id);
    if (!before) return shape;
    // Repeated layout must not create history from floating-point cancellation noise.
    const stable = (value: number, previous: number) =>
      Math.abs(value - previous) <=
      Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(previous)) * 16
        ? previous
        : value;
    return { ...shape, x: stable(shape.x, before.x), y: stable(shape.y, before.y) };
  });
  for (const shape of updates)
    if (
      !Number.isFinite(shape.x) ||
      !Number.isFinite(shape.y) ||
      Math.abs(shape.x) > MAX_COORDINATE ||
      Math.abs(shape.y) > MAX_COORDINATE
    )
      throw new Error("This layout would move a shape beyond the canvas coordinate limit.");
  return updateObjectsTransaction(document, label, { shapes: updates, connectors: [] });
}

/** Only node bounds define the alignment target. Bound arrows derive their new positions. */
export function alignShapesTransaction(
  document: BoardDocument,
  ids: readonly string[],
  alignment: Alignment,
): DocumentTransaction | null {
  const shapes = selectedShapes(document, ids);
  if (shapes.length < 2) return null;
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const shape of shapes) {
    left = Math.min(left, shape.x);
    right = Math.max(right, shape.x + shape.width);
    top = Math.min(top, shape.y);
    bottom = Math.max(bottom, shape.y + shape.height);
  }
  return arrangement(
    document,
    "Align shapes",
    shapes.map((shape) => {
      switch (alignment) {
        case "left":
          return { ...shape, x: left };
        case "horizontal-center":
          return { ...shape, x: left + (right - left - shape.width) / 2 };
        case "right":
          return { ...shape, x: right - shape.width };
        case "top":
          return { ...shape, y: top };
        case "vertical-center":
          return { ...shape, y: top + (bottom - top - shape.height) / 2 };
        case "bottom":
          return { ...shape, y: bottom - shape.height };
      }
    }),
  );
}

/** Equal center spacing; the two outer centers stay fixed and stacking order never changes. */
export function distributeShapesTransaction(
  document: BoardDocument,
  ids: readonly string[],
  axis: DistributionAxis,
): DocumentTransaction | null {
  const shapes = selectedShapes(document, ids);
  if (shapes.length < 3) return null;
  const position = axis === "horizontal" ? "x" : "y";
  const size = axis === "horizontal" ? "width" : "height";
  const center = (shape: Shape) => shape[position] + shape[size] / 2;
  const sorted = shapes.toSorted((a, b) => center(a) - center(b));
  const first = center(sorted[0]!);
  const span = center(sorted.at(-1)!) - first;
  const updates = sorted.slice(1, -1).map((shape, index) => ({
    ...shape,
    [position]: first + (span * (index + 1)) / (sorted.length - 1) - shape[size] / 2,
  }));
  return arrangement(document, "Distribute shape centers", updates);
}
