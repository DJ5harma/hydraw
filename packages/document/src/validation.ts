import { MAX_SHAPES, MAX_DOCUMENT_BYTES, MAX_COORDINATE, MAX_SIZE, FILLS } from "./model.ts";
import type { Fill, Rectangle, BoardDocument } from "./model.ts";

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
  if (!record(value) || value.format !== "hydraw" || value.version !== 0) {
    throw new Error("This board uses an unsupported Hydraw format.");
  }
  if (!Array.isArray(value.shapes) || value.shapes.length > MAX_SHAPES) {
    throw new Error("This board exceeds the supported document limits.");
  }
  const name = decodeName(value.name);
  const ids = new Set<string>();
  const shapes = value.shapes.map((value: unknown): Rectangle => {
    const shape = decodeRectangle(value);
    if (ids.has(shape.id)) throw new Error("This board contains invalid duplicate shape IDs.");
    ids.add(shape.id);
    return shape;
  });
  return Object.freeze({ format: "hydraw", version: 0, name, shapes: Object.freeze(shapes) });
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
