import { rectangleAppearance } from "./appearance.ts";
import { MAX_SHAPES, MAX_CONNECTORS } from "./model.ts";
import type {
  BoardDocument,
  Shape,
  ShapeLabel,
  Connector,
  Endpoint,
  ObjectMetadata,
} from "./model.ts";
import {
  decodeName,
  decodeShape,
  decodeConnector,
  assertConnectorGraph,
  assertImageBudget,
  assertInkBudget,
} from "./validation.ts";
import { isBoardTheme } from "./theme.ts";
import type { BoardTheme } from "./theme.ts";
import {
  FULL_IMAGE_CROP,
  imageBoundsForCrop,
  normalizeImageCrop,
  sourceImageBounds,
} from "./image-crop.ts";
import type { ImageCrop, ImageShape } from "./model.ts";

type RecordChange<T> = Readonly<{ before: T | null; after: T | null; beforeId?: string | null }>;
type ShapeChange = RecordChange<Shape> & Readonly<{ type: "shape" }>;
type ConnectorChange = RecordChange<Connector> & Readonly<{ type: "connector" }>;
type NameChange = Readonly<{ type: "name"; before: string; after: string }>;
type ThemeChange = Readonly<{ type: "theme"; before: BoardTheme; after: BoardTheme }>;
export type DocumentChange = ShapeChange | ConnectorChange | NameChange | ThemeChange;
export type DocumentTransaction = Readonly<{ label: string; changes: readonly DocumentChange[] }>;

function sameLabel(a?: ShapeLabel, b?: ShapeLabel): boolean {
  return (
    a === b ||
    Boolean(
      a &&
      b &&
      a.text === b.text &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.color === b.color,
    )
  );
}

function sameMetadata(a: ObjectMetadata, b: ObjectMetadata): boolean {
  return (
    a.groupId === b.groupId && Boolean(a.locked) === Boolean(b.locked) && a.zIndex === b.zIndex
  );
}

export function sameShape(a: Shape, b: Shape): boolean {
  if (
    !sameMetadata(a, b) ||
    a.id !== b.id ||
    a.type !== b.type ||
    a.x !== b.x ||
    a.y !== b.y ||
    a.width !== b.width ||
    a.height !== b.height
  )
    return false;
  if (a.type === "rectangle" && b.type === "rectangle") {
    const left = rectangleAppearance(a),
      right = rectangleAppearance(b);
    return (
      a.fill === b.fill &&
      (a.kind ?? "rectangle") === (b.kind ?? "rectangle") &&
      sameLabel(a.label, b.label) &&
      left.stroke === right.stroke &&
      left.strokeWidth === right.strokeWidth &&
      left.strokeStyle === right.strokeStyle &&
      left.opacity === right.opacity &&
      left.cornerRadius === right.cornerRadius
    );
  }
  if (a.type === "ink" && b.type === "ink")
    return (
      a.color === b.color &&
      a.strokeWidth === b.strokeWidth &&
      a.points.length === b.points.length &&
      a.points.every((p, i) => p.x === b.points[i]!.x && p.y === b.points[i]!.y)
    );
  if (a.type === "image" && b.type === "image") {
    const left = a.crop ?? FULL_IMAGE_CROP;
    const right = b.crop ?? FULL_IMAGE_CROP;
    return (
      a.src === b.src &&
      Boolean(a.flipX) === Boolean(b.flipX) &&
      Boolean(a.flipY) === Boolean(b.flipY) &&
      a.name === b.name &&
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height
    );
  }
  return (
    a.type === "text" &&
    b.type === "text" &&
    a.text === b.text &&
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.textAlign === b.textAlign &&
    a.color === b.color
  );
}

export function shapeTransaction(
  label: string,
  before: Shape | null,
  after: Shape | null,
  beforeId: string | null = null,
): DocumentTransaction | null {
  if ((!before && !after) || (before && after && sameShape(before, after))) return null;
  const change: ShapeChange = Object.freeze({
    type: "shape",
    beforeId,
    before: before ? decodeShape(before) : null,
    after: after ? decodeShape(after) : null,
  });
  return Object.freeze({ label, changes: Object.freeze([change]) });
}

/** Create a reversible non-destructive crop edit; null restores the original source bounds. */
export function imageCropTransaction(
  document: BoardDocument,
  id: string,
  crop: ImageCrop | null,
): DocumentTransaction | null {
  const image = document.shapes.find((shape) => shape.id === id);
  if (!image || image.type !== "image") throw new Error("The selected image no longer exists.");
  let after: ImageShape;
  if (crop === null) {
    const { crop: _crop, ...rest } = image;
    after = { ...rest, ...sourceImageBounds(image) };
  } else {
    const normalized = normalizeImageCrop(crop);
    if (
      normalized.x === 0 &&
      normalized.y === 0 &&
      normalized.width === 1 &&
      normalized.height === 1
    ) {
      const { crop: _crop, ...rest } = image;
      after = { ...rest, ...sourceImageBounds(image) };
    } else {
      after = { ...image, ...imageBoundsForCrop(image, normalized), crop: normalized };
    }
  }
  return shapeTransaction("Crop image", image, after);
}

function sameEndpoint(a: Endpoint, b: Endpoint): boolean {
  return a.type === "point" && b.type === "point"
    ? a.x === b.x && a.y === b.y
    : a.type === "binding" && b.type === "binding" && a.shapeId === b.shapeId;
}

export function sameConnector(a: Connector, b: Connector): boolean {
  return (
    sameMetadata(a, b) &&
    a.id === b.id &&
    a.type === b.type &&
    a.color === b.color &&
    a.arrowhead === b.arrowhead &&
    a.route?.type === b.route?.type &&
    a.route?.axis === b.route?.axis &&
    a.route?.position === b.route?.position &&
    sameLabel(a.label, b.label) &&
    sameEndpoint(a.start, b.start) &&
    sameEndpoint(a.end, b.end)
  );
}

export function connectorTransaction(
  label: string,
  before: Connector | null,
  after: Connector | null,
  beforeId: string | null = null,
): DocumentTransaction | null {
  if ((!before && !after) || (before && after && sameConnector(before, after))) return null;
  return Object.freeze({
    label,
    changes: Object.freeze([
      Object.freeze({
        type: "connector" as const,
        beforeId,
        before: before ? decodeConnector(before) : null,
        after: after ? decodeConnector(after) : null,
      }),
    ]),
  });
}

export function nameTransaction(before: string, after: string): DocumentTransaction | null {
  if (before === after) return null;
  return Object.freeze({
    label: "Rename board",
    changes: Object.freeze([
      Object.freeze({
        type: "name" as const,
        before: decodeName(before),
        after: decodeName(after),
      }),
    ]),
  });
}

export function boardThemeTransaction(
  before: BoardTheme,
  after: BoardTheme,
): DocumentTransaction | null {
  if (before === after) return null;
  return Object.freeze({
    label: "Change board style",
    changes: Object.freeze([Object.freeze({ type: "theme" as const, before, after })]),
  });
}

/** Resolve IDs and build a canonical inverse while applying one collection's changes. */
function applyRecordChanges<T extends Readonly<{ id: string; type: string }>>(
  records: readonly T[],
  changes: readonly RecordChange<T>[],
  rules: {
    kind: string;
    limit: number;
    decode: (value: unknown) => T;
    same: (a: T, b: T) => boolean;
  },
) {
  if (!changes.length) return { records, applied: [], inverse: [] };
  const positions = new Map(records.map((record, index) => [record.id, index]));
  const applied: RecordChange<T>[] = [];
  const inverse: RecordChange<T>[] = [];
  let next: T[] | null = null;
  for (const { before, after, beforeId = null } of changes) {
    if (!before && !after) throw new Error(`Invalid ${rules.kind} transaction.`);
    const active = next ?? records;
    const index = before
      ? positions.get(before.id)
      : beforeId === null
        ? active.length
        : positions.get(beforeId);
    if (index === undefined)
      throw new Error(
        `The ${rules.kind} target or insertion anchor changed before this transaction.`,
      );
    const current = before ? active[index] : null;
    if (before && (!current || !rules.same(current, before)))
      throw new Error(`The ${rules.kind} changed before this transaction.`);
    if (before && after && (before.id !== after.id || before.type !== after.type))
      throw new Error(`A transaction cannot change ${rules.kind} identity.`);
    if (!before && after && positions.has(after.id))
      throw new Error(`Duplicate ${rules.kind} identity.`);
    const decoded = after ? rules.decode(after) : null;
    if (current && decoded && rules.same(current, decoded)) continue;
    const prior = current ? rules.decode(current) : null;
    applied.push(
      Object.freeze({ before: prior, after: decoded, beforeId: before ? null : beforeId }),
    );
    inverse.push(
      Object.freeze({
        before: decoded,
        after: prior,
        beforeId: before && !after ? (active[index + 1]?.id ?? null) : null,
      }),
    );
    next ??= [...records];
    if (before && decoded) next[index] = decoded;
    else {
      next.splice(index, before ? 1 : 0, ...(decoded ? [decoded] : []));
      if (before) positions.delete(before.id);
      for (let i = index; i < next.length; i++) positions.set(next[i]!.id, i);
    }
    if (next.length > rules.limit)
      throw new Error(`This board exceeds the supported ${rules.kind} limit.`);
  }
  return { records: next ? Object.freeze(next) : records, applied, inverse: inverse.reverse() };
}

/** One ID-addressed edit format for local commands, remote changes and history. */
export function planTransaction(document: BoardDocument, transaction: DocumentTransaction) {
  let name = document.name;
  let theme = document.theme;
  const metadata: DocumentChange[] = [];
  const inverseMetadata: DocumentChange[] = [];
  for (const change of transaction.changes) {
    if (change.type === "name") {
      if (name !== change.before)
        throw new Error("The board name changed before this transaction.");
      const next = decodeName(change.after);
      if (name !== next) {
        metadata.push(Object.freeze({ type: "name", before: name, after: next }));
        inverseMetadata.push(Object.freeze({ type: "name", before: next, after: name }));
        name = next;
      }
    } else if (change.type === "theme") {
      if (theme !== change.before)
        throw new Error("The board style changed before this transaction.");
      if (!isBoardTheme(change.after)) throw new Error("Invalid board style transaction.");
      if (theme !== change.after) {
        metadata.push(Object.freeze({ type: "theme", before: theme, after: change.after }));
        inverseMetadata.push(Object.freeze({ type: "theme", before: change.after, after: theme }));
        theme = change.after;
      }
    } else if (change.type !== "shape" && change.type !== "connector") {
      throw new Error("Invalid document change.");
    }
  }
  const shapes = applyRecordChanges(
    document.shapes,
    transaction.changes.filter((change) => change.type === "shape"),
    {
      kind: "shape",
      limit: MAX_SHAPES,
      decode: decodeShape,
      same: sameShape,
    },
  );
  const connectors = applyRecordChanges(
    document.connectors,
    transaction.changes.filter((change) => change.type === "connector"),
    {
      kind: "connector",
      limit: MAX_CONNECTORS,
      decode: decodeConnector,
      same: sameConnector,
    },
  );
  assertConnectorGraph(shapes.records, connectors.records);
  assertImageBudget(shapes.records);
  assertInkBudget(shapes.records);
  const changes: DocumentChange[] = [
    ...metadata,
    ...shapes.applied.map((change) => Object.freeze({ type: "shape" as const, ...change })),
    ...connectors.applied.map((change) => Object.freeze({ type: "connector" as const, ...change })),
  ];
  const inverse: DocumentChange[] = [
    ...inverseMetadata.reverse(),
    ...shapes.inverse.map((change) => Object.freeze({ type: "shape" as const, ...change })),
    ...connectors.inverse.map((change) => Object.freeze({ type: "connector" as const, ...change })),
  ];
  return Object.freeze({
    document: changes.length
      ? Object.freeze({
          ...document,
          name,
          theme,
          shapes: shapes.records,
          connectors: connectors.records,
        })
      : document,
    edit: Object.freeze({ label: transaction.label, changes: Object.freeze(changes) }),
    inverse: Object.freeze({ label: transaction.label, changes: Object.freeze(inverse) }),
  });
}

export function applyTransaction(
  document: BoardDocument,
  transaction: DocumentTransaction,
): BoardDocument {
  return planTransaction(document, transaction).document;
}
