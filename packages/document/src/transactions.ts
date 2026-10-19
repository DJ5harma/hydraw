import { MAX_SHAPES, MAX_CONNECTORS } from "./model.ts";
import type { BoardDocument, Shape, Connector, Endpoint } from "./model.ts";
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

export function sameShape(a: Shape, b: Shape): boolean {
  if (
    a.id !== b.id ||
    a.type !== b.type ||
    a.x !== b.x ||
    a.y !== b.y ||
    a.width !== b.width ||
    a.height !== b.height
  )
    return false;
  if (a.type === "rectangle" && b.type === "rectangle") return a.fill === b.fill;
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
    a.id === b.id &&
    a.type === b.type &&
    a.color === b.color &&
    a.arrowhead === b.arrowhead &&
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

/** Preconditions make stale inverses fail instead of silently replacing later edits. */
export function applyTransaction(
  document: BoardDocument,
  transaction: DocumentTransaction,
): BoardDocument {
  if (transaction.changes.length === 0) return document;
  const shapes = [...document.shapes];
  const connectors = [...document.connectors];
  let name = document.name;
  for (const change of transaction.changes) {
    if (change.type === "name") {
      if (name !== change.before)
        throw new Error("The board name changed before this transaction.");
      name = decodeName(change.after);
      continue;
    }
    if (change.type === "connector") {
      const { before, after, index } = change;
      if (!Number.isInteger(index) || index < 0 || index > connectors.length || (!before && !after))
        throw new Error("Invalid connector transaction.");
      const current = connectors[index];
      if (before && (!current || !sameConnector(current, before)))
        throw new Error("The connector changed before this transaction.");
      if (before && after && before.id !== after.id)
        throw new Error("A transaction cannot change connector identity.");
      if (
        after &&
        connectors.some(
          (connector, position) => connector.id === after.id && (!before || position !== index),
        )
      )
        throw new Error("Duplicate connector identity.");
      connectors.splice(index, before ? 1 : 0, ...(after ? [decodeConnector(after)] : []));
      if (connectors.length > MAX_CONNECTORS)
        throw new Error("This board exceeds the supported connector limit.");
      continue;
    }
    const { before, after, index } = change;
    if (!Number.isInteger(index) || index < 0 || index > shapes.length || (!before && !after))
      throw new Error("Invalid shape transaction.");
    const current = shapes[index];
    if (before && (!current || !sameShape(current, before)))
      throw new Error("The shape changed before this transaction.");
    if (before && after && (before.id !== after.id || before.type !== after.type))
      throw new Error("A transaction cannot change shape identity.");
    if (
      after &&
      shapes.some((shape, position) => shape.id === after.id && (!before || position !== index))
    )
      throw new Error("Duplicate shape identity.");
    shapes.splice(index, before ? 1 : 0, ...(after ? [decodeShape(after)] : []));
    if (shapes.length > MAX_SHAPES)
      throw new Error("This board exceeds the supported shape limit.");
  }
  assertConnectorGraph(shapes, connectors);
  return Object.freeze({
    ...document,
    name,
    shapes: Object.freeze(shapes),
    connectors: Object.freeze(connectors),
  });
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
