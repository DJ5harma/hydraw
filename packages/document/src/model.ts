/** The portable semantic model. No browser, renderer or framework dependencies. */
export const FILLS = ["#e7eefb", "#e6f2ea", "#fff0d5", "#f7e4ed", "#ffffff"] as const;
export type Fill = (typeof FILLS)[number];
export type Point = Readonly<{ x: number; y: number }>;
export type Rectangle = Readonly<{
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: Fill;
}>;
export type BoardDocument = Readonly<{
  format: "hydraw";
  version: 0;
  name: string;
  shapes: readonly Rectangle[];
}>;

export const MAX_SHAPES = 5_000;
export const MAX_DOCUMENT_BYTES = 2_000_000;
export const MAX_COORDINATE = 1_000_000;
export const MAX_SIZE = 100_000;

export function createDocument(): BoardDocument {
  return { format: "hydraw", version: 0, name: "Untitled board", shapes: [] };
}
