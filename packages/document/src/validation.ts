import {
  MAX_SHAPES,
  MAX_DOCUMENT_BYTES,
  MAX_COORDINATE,
  MAX_SIZE,
  FILLS,
  TEXT_COLORS,
  MAX_TEXT_LENGTH,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
} from "./model.ts";
import type { Fill, Rectangle, BoardDocument, Shape, TextShape, TextColor } from "./model.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function isFill(value: unknown): value is Fill {
  return FILLS.some((fill) => value === fill);
}

/** Decode into new, known fields so persisted data never leaks arbitrary properties. */
export function decodeDocument(value: unknown): BoardDocument {
  if (!record(value) || value.format !== "hydraw" || (value.version !== 0 && value.version !== 1)) {
    throw new Error("This board uses an unsupported Hydraw format.");
  }
  if (!Array.isArray(value.shapes) || value.shapes.length > MAX_SHAPES) {
    throw new Error("This board exceeds the supported document limits.");
  }
  const name = decodeName(value.name);
  const ids = new Set<string>();
  const valueVersion = value.version;
  const shapes = value.shapes.map((value: unknown): Shape => {
    const shape = valueVersion === 0 ? decodeRectangle(value) : decodeShape(value);
    if (ids.has(shape.id)) throw new Error("This board contains invalid duplicate shape IDs.");
    ids.add(shape.id);
    return shape;
  });
  return Object.freeze({ format: "hydraw", version: 1, name, shapes: Object.freeze(shapes) });
}

export function parseDocument(json: string): BoardDocument {
  if (json.length > MAX_DOCUMENT_BYTES) throw new Error("This board file is too large.");
  let bytes = 0;
  for (const character of json) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > MAX_DOCUMENT_BYTES) throw new Error("This board file is too large.");
  }
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  return decodeDocument(value);
}

export function decodeRectangle(shape: unknown): Rectangle {
  if (
    !record(shape) ||
    shape.type !== "rectangle" ||
    typeof shape.id !== "string" ||
    !shape.id ||
    shape.id.length > 100 ||
    !finite(shape.x, -MAX_COORDINATE, MAX_COORDINATE) ||
    !finite(shape.y, -MAX_COORDINATE, MAX_COORDINATE) ||
    !finite(shape.width, 1, MAX_SIZE) ||
    !finite(shape.height, 1, MAX_SIZE) ||
    !isFill(shape.fill)
  ) {
    throw new Error("This board contains an invalid or unsupported shape.");
  }
  return Object.freeze({
    id: shape.id,
    type: "rectangle",
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    fill: shape.fill,
  });
}

export function decodeName(name: unknown): string {
  if (typeof name !== "string" || name.length > 120)
    throw new Error("Board names must be at most 120 characters.");
  return name;
}

export function isTextColor(value: unknown): value is TextColor {
  return TEXT_COLORS.some((color) => color === value);
}

export function decodeShape(value: unknown): Shape {
  if (record(value) && value.type === "text") return decodeText(value);
  return decodeRectangle(value);
}

export function decodeText(shape: unknown): TextShape {
  if (
    !record(shape) ||
    shape.type !== "text" ||
    typeof shape.id !== "string" ||
    !shape.id ||
    shape.id.length > 100 ||
    !finite(shape.x, -MAX_COORDINATE, MAX_COORDINATE) ||
    !finite(shape.y, -MAX_COORDINATE, MAX_COORDINATE) ||
    !finite(shape.width, 1, MAX_SIZE) ||
    !finite(shape.height, 1, MAX_COORDINATE) ||
    typeof shape.text !== "string" ||
    shape.text.length > MAX_TEXT_LENGTH ||
    hasControlCharacters(shape.text) ||
    !finite(shape.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE) ||
    (shape.fontWeight !== 400 && shape.fontWeight !== 700) ||
    (shape.textAlign !== "left" && shape.textAlign !== "center" && shape.textAlign !== "right") ||
    !isTextColor(shape.color)
  )
    throw new Error("This board contains invalid text.");
  return Object.freeze({
    id: shape.id,
    type: "text",
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    text: shape.text,
    fontSize: shape.fontSize,
    fontWeight: shape.fontWeight,
    textAlign: shape.textAlign,
    color: shape.color,
  });
}

function hasControlCharacters(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if ((code < 32 && code !== 10) || code === 127) return true;
  }
  return false;
}
