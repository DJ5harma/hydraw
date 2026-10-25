import { applyTransaction, invertTransaction } from "./transactions.ts";
import type { DocumentChange, DocumentTransaction } from "./transactions.ts";
import type { BoardDocument, Shape, Connector } from "./model.ts";
import { decodeShape, decodeConnector } from "./validation.ts";

type ObjectChange<T, Kind extends string> = Readonly<{
  type: Kind;
  before: T | null;
  after: T | null;
  /** Insertion anchor; null appends in the authoritative acceptance order. */
  beforeId: string | null;
}>;
export type OperationChange =
  | ObjectChange<Shape, "shape">
  | ObjectChange<Connector, "connector">
  | Extract<DocumentChange, { type: "name" | "theme" }>;
export type DocumentOperation = Readonly<{
  label: string;
  changes: readonly OperationChange[];
}>;

/** Translate a validated local plan into an immutable, ID-addressed change batch. */
export function operationFromTransaction(
  document: BoardDocument,
  transaction: DocumentTransaction,
): DocumentOperation {
  applyTransaction(document, transaction);
  return describeTransaction(document, transaction);
}

function describeTransaction(
  document: BoardDocument,
  transaction: DocumentTransaction,
): DocumentOperation {
  const shapes: (Shape | Connector)[] = [...document.shapes];
  const connectors: (Shape | Connector)[] = [...document.connectors];
  const changes = transaction.changes.map((change): OperationChange => {
    if (change.type === "name" || change.type === "theme") return Object.freeze({ ...change });
    const records = change.type === "shape" ? shapes : connectors;
    const beforeId = change.before ? null : (records[change.index]?.id ?? null);
    // Only IDs are needed for subsequent anchor planning; application validates records.
    records.splice(change.index, change.before ? 1 : 0, ...(change.after ? [change.after] : []));
    if (change.type === "shape")
      return Object.freeze({
        type: "shape",
        before: change.before ? decodeShape(change.before) : null,
        after: change.after ? decodeShape(change.after) : null,
        beforeId,
      });
    return Object.freeze({
      type: "connector",
      before: change.before ? decodeConnector(change.before) : null,
      after: change.after ? decodeConnector(change.after) : null,
      beforeId,
    });
  });
  return Object.freeze({ label: transaction.label, changes: Object.freeze(changes) });
}

/** Resolve IDs before atomically validating the complete graph. */
function resolveOperation(
  document: BoardDocument,
  operation: DocumentOperation,
): DocumentTransaction {
  const shapes: (Shape | Connector)[] = [...document.shapes];
  const connectors: (Shape | Connector)[] = [...document.connectors];
  const shapePositions = new Map(shapes.map((shape, index) => [shape.id, index]));
  const connectorPositions = new Map(connectors.map((connector, index) => [connector.id, index]));
  const changes = operation.changes.map((change): DocumentChange => {
    if (change.type === "name" || change.type === "theme") return change;
    if (change.type !== "shape" && change.type !== "connector")
      throw new Error("Invalid operation change.");
    if (!change.before && !change.after) throw new Error("Invalid empty object change.");
    const records = change.type === "shape" ? shapes : connectors;
    const positions = change.type === "shape" ? shapePositions : connectorPositions;
    const index = change.before
      ? (positions.get(change.before.id) ?? -1)
      : change.beforeId === null
        ? records.length
        : (positions.get(change.beforeId) ?? -1);
    if (index < 0) throw new Error("An operation target or insertion anchor changed.");
    if (change.before && change.after) {
      records[index] = change.after;
    } else {
      records.splice(index, change.before ? 1 : 0, ...(change.after ? [change.after] : []));
      if (change.before) positions.delete(change.before.id);
      for (let i = index; i < records.length; i++) positions.set(records[i]!.id, i);
    }
    if (change.type === "shape")
      return { type: "shape", index, before: change.before, after: change.after };
    return { type: "connector", index, before: change.before, after: change.after };
  });
  const transaction = Object.freeze({ label: operation.label, changes: Object.freeze(changes) });
  return transaction;
}

export function applyOperation(document: BoardDocument, operation: DocumentOperation) {
  const transaction = resolveOperation(document, operation);
  return planTransaction(document, transaction);
}

/** Validate one local plan once, returning its committed state and canonical inverse. */
export function planTransaction(document: BoardDocument, transaction: DocumentTransaction) {
  const next = applyTransaction(document, transaction);
  return Object.freeze({
    document: next,
    edit: describeTransaction(document, transaction),
    inverse: describeTransaction(next, invertTransaction(transaction)),
  });
}

export function operationObjectIds(operation: DocumentOperation): readonly string[] {
  return Object.freeze([
    ...new Set(
      operation.changes.flatMap((change) =>
        change.type === "shape" || change.type === "connector"
          ? [change.before?.id ?? change.after!.id]
          : [],
      ),
    ),
  ]);
}

/** Keys isolate independent records, while guarding membership, bindings and scene order. */
export function operationDependencies(operation: DocumentOperation): readonly string[] {
  const keys = new Set(
    operationWriteKeys(operation).filter(
      (key) =>
        key.startsWith("shape:") ||
        key.startsWith("connector:") ||
        key === "name" ||
        key === "theme",
    ),
  );
  for (const change of operation.changes) {
    if (change.type !== "shape" && change.type !== "connector") continue;
    if (!change.before && change.beforeId) keys.add(`${change.type}:${change.beforeId}`);
    if (change.type === "shape" && change.before && !change.after)
      keys.add(`links:${change.before.id}`);
    for (const groupId of [change.before?.groupId, change.after?.groupId])
      if (groupId) keys.add(`group:${groupId}`);
    if (change.before && change.after && change.before.zIndex !== change.after.zIndex)
      keys.add("order");
    if (change.type === "connector")
      for (const endpoint of [change.after?.start, change.after?.end])
        if (endpoint?.type === "binding") keys.add(`shape:${endpoint.shapeId}`);
  }
  return Object.freeze([...keys]);
}

export function operationWriteKeys(operation: DocumentOperation): readonly string[] {
  const keys = new Set<string>();
  for (const change of operation.changes) {
    if (change.type === "name" || change.type === "theme") {
      keys.add(change.type);
      continue;
    }
    keys.add(`${change.type}:${change.before?.id ?? change.after!.id}`);
    if (!change.before || !change.after || change.before.groupId !== change.after.groupId)
      for (const groupId of [change.before?.groupId, change.after?.groupId])
        if (groupId) keys.add(`group:${groupId}`);
    if (!change.before || !change.after || change.before.zIndex !== change.after.zIndex)
      keys.add("order");
    if (change.type === "connector")
      for (const endpoint of [
        change.before?.start,
        change.before?.end,
        change.after?.start,
        change.after?.end,
      ])
        if (endpoint?.type === "binding") keys.add(`links:${endpoint.shapeId}`);
  }
  return Object.freeze([...keys]);
}
