/** The portable semantic model. No browser, renderer or framework dependencies. */
export const FILLS = ["#e7eefb", "#e6f2ea", "#fff0d5", "#f7e4ed", "#ffffff"] as const;
export type Fill = (typeof FILLS)[number];
export type Point = Readonly<{ x: number; y: number }>;
export type Bounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;
export type Rectangle = Bounds &
  Readonly<{
    id: string;
    type: "rectangle";
    fill: Fill;
  }>;
export const TEXT_COLORS = ["#243e33", "#3568db", "#8d315a", "#805d20", "#202124"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];
export type TextShape = Bounds &
  Readonly<{
    id: string;
    type: "text";
    text: string;
    fontSize: number;
    fontWeight: 400 | 700;
    textAlign: "left" | "center" | "right";
    color: TextColor;
  }>;
export type Shape = Rectangle | TextShape;
export const MAX_TEXT_LENGTH = 2_000;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 96;

export type BoardDocument = Readonly<{
  format: "hydraw";
  version: 1;
  name: string;
  shapes: readonly Shape[];
}>;

export const MAX_SHAPES = 5_000;
export const MAX_DOCUMENT_BYTES = 2_000_000;
export const MAX_COORDINATE = 1_000_000;
export const MAX_SIZE = 100_000;

export function createDocument(): BoardDocument {
  return { format: "hydraw", version: 1, name: "Untitled board", shapes: [] };
}
