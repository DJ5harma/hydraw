import { MAX_INK_POINTS } from "./ink.ts";
import type { InkShape } from "./ink.ts";
import type { RectangleAppearance } from "./appearance.ts";
import {
  MAX_SHAPES,
  MAX_IMAGE_DATA_LENGTH,
  MAX_BOARD_IMAGE_DATA_LENGTH,
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
import { isBoardTheme } from "./theme.ts";
import { assertValidSourceImageBounds, normalizeImageCrop } from "./image-crop.ts";
import type {
  Fill,
  ImageShape,
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
  if (!record(value) || value.format !== "hydraw" || value.version !== 1) {
    throw new Error("This board uses an unsupported Hydraw format.");
  }
  if (!Array.isArray(value.shapes) || value.shapes.length > MAX_SHAPES) {
    throw new Error("This board exceeds the supported document limits.");
  }
  const name = decodeName(value.name);
  const ids = new Set<string>();
  if (!isBoardTheme(value.theme))
    throw new Error("This board contains an unsupported visual theme.");
  const shapes = value.shapes.map((value: unknown): Shape => {
    const shape = decodeShape(value);
    if (ids.has(shape.id)) throw new Error("This board contains invalid duplicate shape IDs.");
    ids.add(shape.id);
    return shape;
  });
  assertImageBudget(shapes);
  assertInkBudget(shapes);
  const connectors = decodeConnectors(value.connectors);
  assertConnectorGraph(shapes, connectors);
  return Object.freeze({
    format: "hydraw",
    version: 1,
    theme: value.theme,
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
  if (record(value) && value.type === "ink") return decodeInk(value);
  if (record(value) && value.type === "image") return decodeImage(value);
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

/** Embedded PNGs keep image boards portable, offline and free of external fetches. */
export function decodeImage(value: unknown): ImageShape {
  if (
    !record(value) ||
    value.type !== "image" ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 100 ||
    !finite(value.x, -MAX_COORDINATE, MAX_COORDINATE) ||
    !finite(value.y, -MAX_COORDINATE, MAX_COORDINATE) ||
    !finite(value.width, 1, MAX_SIZE) ||
    !finite(value.height, 1, MAX_SIZE) ||
    typeof value.name !== "string" ||
    value.name.length > 120 ||
    typeof value.src !== "string" ||
    value.src.length > MAX_IMAGE_DATA_LENGTH ||
    !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/u.test(value.src)
  )
    throw new Error(
      "This board contains an invalid image. Images must be embedded PNGs under 3 MB.",
    );
  const crop = value.crop === undefined ? undefined : normalizeImageCrop(value.crop);
  const image = Object.freeze({
    id: value.id,
    type: "image",
    ...decodeMetadata(value),
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    name: value.name,
    src: value.src,
    ...(crop ? { crop } : {}),
  });
  if (crop) assertValidSourceImageBounds(image);
  return image;
}

export function assertImageBudget(shapes: readonly Shape[]): void {
  let length = 0;
  for (const shape of shapes) {
    if (shape.type === "image") length += shape.src.length;
    if (length > MAX_BOARD_IMAGE_DATA_LENGTH)
      throw new Error(
        "This board has reached its 24 MB embedded image limit. Remove an image or use a smaller one.",
      );
  }
}

export function decodeInk(value: unknown): InkShape {
  if (
    !record(value) ||
    value.type !== "ink" ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 100 ||
    !finite(value.x, -MAX_COORDINATE, MAX_COORDINATE) ||
    !finite(value.y, -MAX_COORDINATE, MAX_COORDINATE) ||
    !finite(value.width, 1, MAX_SIZE) ||
    !finite(value.height, 1, MAX_SIZE) ||
    !isTextColor(value.color) ||
    !finite(value.strokeWidth, 0.5, 12) ||
    !Array.isArray(value.points) ||
    !value.points.length ||
    value.points.length > MAX_INK_POINTS
  )
    throw new Error("This board contains an invalid freehand path.");
  const points = value.points.map((point: unknown) => {
    if (!record(point) || !finite(point.x, 0, 1) || !finite(point.y, 0, 1))
      throw new Error("This board contains invalid freehand points.");
    return Object.freeze({ x: point.x, y: point.y });
  });
  return Object.freeze({
    id: value.id,
    type: "ink",
    ...decodeMetadata(value),
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    color: value.color,
    strokeWidth: value.strokeWidth,
    points: Object.freeze(points),
  });
}

export const MAX_BOARD_INK_POINTS = 100_000;
export function assertInkBudget(shapes: readonly Shape[]): void {
  let count = 0;
  for (const shape of shapes) {
    if (shape.type === "ink") count += shape.points.length;
    if (count > MAX_BOARD_INK_POINTS)
      throw new Error("This board has reached its 100,000 freehand point limit.");
  }
}
