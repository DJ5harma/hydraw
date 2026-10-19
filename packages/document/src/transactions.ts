import { MAX_SHAPES } from "./model.ts";
import type { BoardDocument, Rectangle } from "./model.ts";
import { decodeName, decodeRectangle } from "./validation.ts";

type ShapeChange = Readonly<{
  type: "shape";
  index: number;
  before: Rectangle | null;
  after: Rectangle | null;
}>;
type NameChange = Readonly<{ type: "name"; before: string; after: string }>;
export type DocumentChange = ShapeChange | NameChange;
export type DocumentTransaction = Readonly<{ label: string; changes: readonly DocumentChange[] }>;

export function sameRectangle(a: Rectangle, b: Rectangle): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.fill === b.fill
  );
}

export function shapeTransaction(
  label: string,
  index: number,
  before: Rectangle | null,
  after: Rectangle | null,
): DocumentTransaction | null {
  if ((!before && !after) || (before && after && sameRectangle(before, after))) return null;
  const change: ShapeChange = Object.freeze({
    type: "shape",
    index,
    before: before ? decodeRectangle(before) : null,
    after: after ? decodeRectangle(after) : null,
  });
  return Object.freeze({ label, changes: Object.freeze([change]) });
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
  let name = document.name;
  for (const change of transaction.changes) {
    if (change.type === "name") {
      if (name !== change.before)
        throw new Error("The board name changed before this transaction.");
      name = decodeName(change.after);
      continue;
    }
    const { before, after, index } = change;
    if (!Number.isInteger(index) || index < 0 || index > shapes.length || (!before && !after))
      throw new Error("Invalid shape transaction.");
    const current = shapes[index];
    if (before && (!current || !sameRectangle(current, before)))
      throw new Error("The shape changed before this transaction.");
    if (before && after && before.id !== after.id)
      throw new Error("A transaction cannot change shape identity.");
    if (
      after &&
      shapes.some((shape, position) => shape.id === after.id && (!before || position !== index))
    )
      throw new Error("Duplicate shape identity.");
    shapes.splice(index, before ? 1 : 0, ...(after ? [decodeRectangle(after)] : []));
    if (shapes.length > MAX_SHAPES)
      throw new Error("This board exceeds the supported shape limit.");
  }
  return Object.freeze({ ...document, name, shapes: Object.freeze(shapes) });
}

export function invertTransaction(transaction: DocumentTransaction): DocumentTransaction {
  return Object.freeze({
    label: transaction.label,
    changes: Object.freeze(
      [...transaction.changes].reverse().map((change): DocumentChange =>
        change.type === "shape"
          ? Object.freeze({
              type: "shape",
              index: change.index,
              before: change.after,
              after: change.before,
            })
          : Object.freeze({ type: "name", before: change.after, after: change.before }),
      ),
    ),
  });
}
