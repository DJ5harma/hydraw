/** Rectangle presentation defaults preserve the appearance of earlier documents. */
export type RectangleAppearance = Readonly<{
  stroke: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  cornerRadius: number;
}>;
export const DEFAULT_RECTANGLE_APPEARANCE: RectangleAppearance = Object.freeze({
  stroke: "#364152",
  strokeWidth: 1.5,
  strokeStyle: "solid",
  opacity: 100,
  cornerRadius: 8,
});
export function rectangleAppearance(shape: {
  appearance?: RectangleAppearance;
}): RectangleAppearance {
  return shape.appearance ?? DEFAULT_RECTANGLE_APPEARANCE;
}
