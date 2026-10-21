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
import { decodeName, decodeShape, decodeConnector, assertConnectorGraph } from "./validation.ts";

type ShapeChange = Readonly<{
  type: "shape";
  index: number;
  before: Shape | null;
  after: Shape | null;
}>;
type ConnectorChange = Readonly<{
  type: "connector";
  index: number;
  before: Connector | null;
  after: Connector | null;
}>;
type NameChange = Readonly<{ type: "name"; before: string; after: string }>;
export type DocumentChange = ShapeChange | ConnectorChange | NameChange;
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
  index: number,
  before: Shape | null,
  after: Shape | null,
): DocumentTransaction | null {
  if ((!before && !after) || (before && after && sameShape(before, after))) return null;
  const change: ShapeChange = Object.freeze({
    type: "shape",
    index,
    before: before ? decodeShape(before) : null,
    after: after ? decodeShape(after) : null,
  });
  return Object.freeze({ label, changes: Object.freeze([change]) });
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
    sameLabel(a.label, b.label) &&
    sameEndpoint(a.start, b.start) &&
    sameEndpoint(a.end, b.end)
  );
}

export function connectorTransaction(
  label: string,
  index: number,
  before: Connector | null,
  after: Connector | null,
): DocumentTransaction | null {
  if ((!before && !after) || (before && after && sameConnector(before, after))) return null;
  return Object.freeze({
    label,
    changes: Object.freeze([
      Object.freeze({
        type: "connector" as const,
        index,
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

type RecordChange<T> = Readonly<{ index: number; before: T | null; after: T | null }>;

/** Each collection is copied only when touched; all changes stay private until graph validation. */
function applyRecordChanges<T extends Readonly<{ id: string; type: string }>>(
  records: readonly T[],
  changes: readonly RecordChange<T>[],
  rules: {
    kind: string;
    limit: number;
    decode: (value: unknown) => T;
    same: (a: T, b: T) => boolean;
  },
): readonly T[] {
  if (!changes.length) return records;
  const next = [...records];
  const ids = new Set(records.map((record) => record.id));
  for (const { before, after, index } of changes) {
    if (!Number.isInteger(index) || index < 0 || index > next.length || (!before && !after))
      throw new Error(`Invalid ${rules.kind} transaction.`);
    const current = next[index];
    if (before && (!current || !rules.same(current, before)))
      throw new Error(`The ${rules.kind} changed before this transaction.`);
    if (before && after && (before.id !== after.id || before.type !== after.type))
      throw new Error(`A transaction cannot change ${rules.kind} identity.`);
    if (!before && after && ids.has(after.id)) throw new Error(`Duplicate ${rules.kind} identity.`);
    const decoded = after ? rules.decode(after) : null;
    next.splice(index, before ? 1 : 0, ...(decoded ? [decoded] : []));
    if (before) ids.delete(before.id);
    if (after) ids.add(after.id);
    if (next.length > rules.limit)
      throw new Error(`This board exceeds the supported ${rules.kind} limit.`);
  }
  return Object.freeze(next);
}

/** Preconditions make stale inverses fail instead of silently replacing later edits. */
export function applyTransaction(
  document: BoardDocument,
  transaction: DocumentTransaction,
): BoardDocument {
  if (transaction.changes.length === 0) return document;
  let name = document.name;
  for (const change of transaction.changes) {
    if (change.type !== "name") continue;
    if (name !== change.before) throw new Error("The board name changed before this transaction.");
    name = decodeName(change.after);
  }
  const shapes = applyRecordChanges(
    document.shapes,
    transaction.changes.filter((change) => change.type === "shape"),
    { kind: "shape", limit: MAX_SHAPES, decode: decodeShape, same: sameShape },
  );
  const connectors = applyRecordChanges(
    document.connectors,
    transaction.changes.filter((change) => change.type === "connector"),
    { kind: "connector", limit: MAX_CONNECTORS, decode: decodeConnector, same: sameConnector },
  );
  assertConnectorGraph(shapes, connectors);
  return Object.freeze({ ...document, name, shapes, connectors });
}

export function invertTransaction(transaction: DocumentTransaction): DocumentTransaction {
  return Object.freeze({
    label: transaction.label,
    changes: Object.freeze([...transaction.changes].reverse().map(invertChange)),
  });
}

function invertChange(change: DocumentChange): DocumentChange {
  if (change.type === "name")
    return Object.freeze({ type: "name", before: change.after, after: change.before });
  if (change.type === "connector")
    return Object.freeze({
      type: "connector",
      index: change.index,
      before: change.after,
      after: change.before,
    });
  return Object.freeze({
    type: "shape",
    index: change.index,
    before: change.after,
    after: change.before,
  });
}
