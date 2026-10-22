import type { RectangleAppearance } from "./appearance.ts";
import type { BoardTheme } from "./theme.ts";
/** The portable semantic model. No browser, renderer or framework dependencies. */
export const FILLS = [
  "#e7eefb",
  "#e6f2ea",
  "#fff0d5",
  "#f7e4ed",
  "#ffffff",
  "transparent",
] as const;
export type Fill = (typeof FILLS)[number];
export type Point = Readonly<{ x: number; y: number }>;
export type Bounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;
export type ShapeKind = "rectangle" | "ellipse" | "diamond" | "frame";
export type ShapeLabel = Readonly<{
  text: string;
  fontSize: number;
  fontWeight: 400 | 700;
  color: TextColor;
}>;
export type ObjectMetadata = Readonly<{ groupId?: string; locked?: boolean; zIndex?: number }>;
export type Rectangle = Bounds &
  ObjectMetadata &
  Readonly<{
    id: string;
    type: "rectangle";
    fill: Fill;
    appearance?: RectangleAppearance;
    kind?: ShapeKind;
    label?: ShapeLabel;
  }>;
export const TEXT_COLORS = ["#243e33", "#3568db", "#8d315a", "#805d20", "#202124"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];
export type TextShape = Bounds &
  ObjectMetadata &
  Readonly<{
    id: string;
    type: "text";
    text: string;
    fontSize: number;
    fontWeight: 400 | 700;
    textAlign: "left" | "center" | "right";
    color: TextColor;
  }>;
export type ImageShape = Bounds &
  ObjectMetadata &
  Readonly<{
    id: string;
    type: "image";
    src: string;
    name: string;
  }>;
export const MAX_IMAGE_DATA_LENGTH = 4_000_000;
export const MAX_BOARD_IMAGE_DATA_LENGTH = 24_000_000;
export type Shape = Rectangle | TextShape | ImageShape;
export type Endpoint =
  | Readonly<{ type: "point"; x: number; y: number }>
  | Readonly<{ type: "binding"; shapeId: string }>;
export type Connector = ObjectMetadata &
  Readonly<{
    id: string;
    type: "connector";
    start: Endpoint;
    end: Endpoint;
    color: TextColor;
    arrowhead: "arrow" | "none";
    label?: ShapeLabel;
  }>;
export const MAX_CONNECTORS = 5_000;
export const MAX_TEXT_LENGTH = 2_000;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 96;

export type BoardDocument = Readonly<{
  format: "hydraw";
  version: 8;
  theme?: BoardTheme;
  name: string;
  shapes: readonly Shape[];
  connectors: readonly Connector[];
}>;

export const MAX_SHAPES = 5_000;
// Covers the worst-case JSON encoding of every permitted record, including escaped Unicode.
// Record counts and text lengths remain the tighter semantic limits.
export const MAX_DOCUMENT_BYTES = 160_000_000;
export const MAX_COORDINATE = 1_000_000;
// Bound endpoints may lie beyond a node origin by the node's width/height.
export const MAX_ENDPOINT_COORDINATE = MAX_COORDINATE * 2;
export const MAX_SIZE = 100_000;

export function createDocument(): BoardDocument {
  return {
    format: "hydraw",
    version: 8,
    theme: "clean",
    name: "Untitled board",
    shapes: [],
    connectors: [],
  };
}
