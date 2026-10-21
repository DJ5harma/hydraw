import type { RectangleAppearance } from "./appearance.ts";
import {
  MAX_SHAPES,
  MAX_CONNECTORS,
  MAX_ENDPOINT_COORDINATE,
  MAX_DOCUMENT_BYTES,
  MAX_COORDINATE,
  MAX_SIZE,
  FILLS,
  TEXT_COLORS,
  MAX_TEXT_LENGTH,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
} from "./model.ts";
import type {
  Fill,
  ObjectMetadata,
  ShapeLabel,
  Rectangle,
  BoardDocument,
  Shape,
  TextShape,
  TextColor,
  Connector,
  Endpoint,
} from "./model.ts";

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
  if (
    !record(value) ||
    value.format !== "hydraw" ||
    (value.version !== 0 &&
      value.version !== 1 &&
      value.version !== 2 &&
      value.version !== 3 &&
      value.version !== 4 &&
      value.version !== 5 &&
      value.version !== 6)
  ) {
    throw new Error("This board uses an unsupported Hydraw format.");
  }
  if (!Array.isArray(value.shapes) || value.shapes.length > MAX_SHAPES) {
    throw new Error("This board exceeds the supported document limits.");
  }
  const name = decodeName(value.name);
  const ids = new Set<string>();
  const valueVersion = value.version;
  const shapes = value.shapes.map((value: unknown): Shape => {
    if (
      valueVersion < 3 &&
      record(value) &&
      (value.appearance !== undefined || value.fill === "transparent")
    )
      throw new Error("Rectangle appearance requires Hydraw version 3.");
    if (
      valueVersion < 4 &&
      record(value) &&
      (value.kind !== undefined || value.label !== undefined)
    )
      throw new Error("Shape kinds and labels require Hydraw version 4.");
    if (valueVersion < 5 && record(value) && hasMetadata(value))
      throw new Error("Object organization requires Hydraw version 5.");
    if (valueVersion < 6 && record(value) && value.kind === "frame")
      throw new Error("Frames require Hydraw version 6.");
    const shape = valueVersion === 0 ? decodeRectangle(value) : decodeShape(value);
    if (ids.has(shape.id)) throw new Error("This board contains invalid duplicate shape IDs.");
    ids.add(shape.id);
    return shape;
  });
  if (
    valueVersion < 2 &&
    value.connectors !== undefined &&
    (!Array.isArray(value.connectors) || value.connectors.length !== 0)
  )
    throw new Error("Connectors require Hydraw version 2.");
  if (
    valueVersion < 4 &&
    Array.isArray(value.connectors) &&
    value.connectors.some((item: unknown) => record(item) && item.label !== undefined)
  )
    throw new Error("Connector labels require Hydraw version 4.");
  if (
    valueVersion < 5 &&
    Array.isArray(value.connectors) &&
    value.connectors.some((item: unknown) => record(item) && hasMetadata(item))
  )
    throw new Error("Object organization requires Hydraw version 5.");
  const connectors = decodeConnectors(valueVersion >= 2 ? value.connectors : []);
  assertConnectorGraph(shapes, connectors);
  return Object.freeze({
    format: "hydraw",
    version: 6,
    name,
    shapes: Object.freeze(shapes),
    connectors: Object.freeze(connectors),
  });
}

/** Compact native encoding; never serialize view state or unknown input fields. */
export function serializeDocument(document: BoardDocument): string {
  return JSON.stringify(decodeDocument(document));
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
    !isFill(shape.fill) ||
    (shape.kind !== undefined &&
      shape.kind !== "rectangle" &&
      shape.kind !== "ellipse" &&
      shape.kind !== "diamond" &&
      shape.kind !== "frame")
  ) {
    throw new Error("This board contains an invalid or unsupported shape.");
  }
  return Object.freeze({
    id: shape.id,
    type: "rectangle",
    ...decodeMetadata(shape),
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    fill: shape.fill,
    ...(shape.kind === undefined ? {} : { kind: shape.kind }),
    ...(shape.label === undefined ? {} : { label: decodeLabel(shape.label) }),
    ...(shape.appearance === undefined ? {} : { appearance: decodeAppearance(shape.appearance) }),
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
    ...decodeMetadata(shape),
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

export function decodeEndpoint(value: unknown): Endpoint {
  if (record(value)) {
    if (
      value.type === "point" &&
      finite(value.x, -MAX_ENDPOINT_COORDINATE, MAX_ENDPOINT_COORDINATE) &&
      finite(value.y, -MAX_ENDPOINT_COORDINATE, MAX_ENDPOINT_COORDINATE)
    )
      return Object.freeze({ type: "point", x: value.x, y: value.y });
    if (
      value.type === "binding" &&
      typeof value.shapeId === "string" &&
      value.shapeId.length > 0 &&
      value.shapeId.length <= 100
    )
      return Object.freeze({ type: "binding", shapeId: value.shapeId });
  }
  throw new Error("This board contains an invalid connector endpoint.");
}

export function decodeConnector(value: unknown): Connector {
  if (
    !record(value) ||
    value.type !== "connector" ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 100 ||
    !isTextColor(value.color) ||
    (value.arrowhead !== "arrow" && value.arrowhead !== "none")
  )
    throw new Error("This board contains an invalid connector.");
  const start = decodeEndpoint(value.start);
  const end = decodeEndpoint(value.end);
  if (start.type === "binding" && end.type === "binding" && start.shapeId === end.shapeId)
    throw new Error("Connectors cannot bind both ends to the same object yet.");
  return Object.freeze({
    id: value.id,
    type: "connector",
    ...decodeMetadata(value),
    start,
    end,
    color: value.color,
    arrowhead: value.arrowhead,
    ...(value.label === undefined ? {} : { label: decodeLabel(value.label) }),
  });
}

function decodeConnectors(value: unknown): Connector[] {
  if (!Array.isArray(value) || value.length > MAX_CONNECTORS)
    throw new Error("This board exceeds the supported connector limits.");
  return value.map((connector: unknown) => decodeConnector(connector));
}

/** Validate only the completed graph, so a transaction can remove nodes and edges atomically. */
export function assertConnectorGraph(
  shapes: readonly Shape[],
  connectors: readonly Connector[],
): void {
  const shapeIds = new Set(shapes.map((shape) => shape.id));
  const shapesById = new Map(shapes.map((shape) => [shape.id, shape]));
  const ids = new Set(shapeIds);
  for (const connector of connectors) {
    if (ids.has(connector.id)) throw new Error("This board contains invalid duplicate object IDs.");
    ids.add(connector.id);
    for (const endpoint of [connector.start, connector.end])
      if (endpoint.type === "binding" && !shapeIds.has(endpoint.shapeId))
        throw new Error("A connector refers to a missing object.");
      else if (
        endpoint.type === "binding" &&
        shapesById.get(endpoint.shapeId)?.type === "rectangle" &&
        (shapesById.get(endpoint.shapeId) as Rectangle).kind === "frame"
      )
        throw new Error("Connectors cannot bind to frames.");
  }
}

function decodeAppearance(value: unknown): RectangleAppearance {
  if (
    !record(value) ||
    typeof value.stroke !== "string" ||
    !/^#[0-9a-f]{6}$/iu.test(value.stroke) ||
    !finite(value.strokeWidth, 0.5, 12) ||
    !finite(value.opacity, 0, 100) ||
    !finite(value.cornerRadius, 0, 50) ||
    (value.strokeStyle !== "solid" &&
      value.strokeStyle !== "dashed" &&
      value.strokeStyle !== "dotted")
  ) {
    throw new Error("This board contains invalid rectangle styling.");
  }
  return Object.freeze({
    stroke: value.stroke.toLowerCase(),
    strokeWidth: value.strokeWidth,
    strokeStyle: value.strokeStyle,
    opacity: value.opacity,
    cornerRadius: value.cornerRadius,
  });
}

export function decodeLabel(value: unknown): ShapeLabel {
  if (
    !record(value) ||
    typeof value.text !== "string" ||
    value.text.length > MAX_TEXT_LENGTH ||
    hasControlCharacters(value.text) ||
    !finite(value.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE) ||
    (value.fontWeight !== 400 && value.fontWeight !== 700) ||
    !isTextColor(value.color)
  )
    throw new Error("This board contains an invalid label.");
  return Object.freeze({
    text: value.text,
    fontSize: value.fontSize,
    fontWeight: value.fontWeight,
    color: value.color,
  });
}

function hasMetadata(value: Record<string, unknown>): boolean {
  return value.groupId !== undefined || value.locked !== undefined || value.zIndex !== undefined;
}
function decodeMetadata(value: Record<string, unknown>): ObjectMetadata {
  if (
    (value.groupId !== undefined &&
      (typeof value.groupId !== "string" || !value.groupId || value.groupId.length > 100)) ||
    (value.locked !== undefined && typeof value.locked !== "boolean") ||
    (value.zIndex !== undefined && !finite(value.zIndex, -1_000_000_000, 1_000_000_000))
  )
    throw new Error("This board contains invalid object organization.");
  return {
    ...(value.groupId === undefined ? {} : { groupId: value.groupId as string }),
    ...(value.locked === undefined ? {} : { locked: value.locked as boolean }),
    ...(value.zIndex === undefined ? {} : { zIndex: value.zIndex as number }),
  };
}
