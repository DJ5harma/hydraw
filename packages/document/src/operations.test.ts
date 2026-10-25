import { describe, expect, it } from "vite-plus/test";
import {
  applyOperation,
  applyTransaction,
  createDocument,
  decodeDocument,
  deleteObjectsTransaction,
  operationFromTransaction,
  shapeTransaction,
} from "./index.ts";
import type { DocumentTransaction } from "./index.ts";

const a = {
  id: "a",
  type: "rectangle" as const,
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  fill: "#e7eefb" as const,
};
const b = { ...a, id: "b", x: 200 };
const initial = () => decodeDocument({ ...createDocument(), shapes: [a, b] });

describe("ID-addressed document operations", () => {
  it("applies to the intended ID after an unrelated deletion shifts its array position", () => {
    const document = initial();
    const edit = operationFromTransaction(
      document,
      shapeTransaction("Move B", 1, b, { ...b, x: 300 })!,
    );
    const shifted = applyTransaction(document, deleteObjectsTransaction(document, [a.id])!);
    const result = applyOperation(shifted, edit);
    expect(result.document.shapes).toEqual([{ ...b, x: 300 }]);
    expect(applyOperation(result.document, result.inverse).document).toEqual(shifted);
  });

  it("retains insertion order and inverts repeated updates in one atomic operation", () => {
    const document = initial();
    const transaction: DocumentTransaction = {
      label: "Reorganize",
      changes: [
        { type: "shape", index: 0, before: a, after: null },
        { type: "shape", index: 1, before: null, after: a },
        { type: "shape", index: 1, before: a, after: { ...a, x: 50 } },
      ],
    };
    const operation = operationFromTransaction(document, transaction);
    expect(operation.changes.every((change) => !("index" in change))).toBe(true);
    const result = applyOperation(document, operation);
    expect(result.document.shapes.map((shape) => shape.id)).toEqual(["b", "a"]);
    expect(applyOperation(result.document, result.inverse).document).toEqual(document);
  });

  it("rejects a whole stale graph batch without applying an earlier rename", () => {
    const document = initial();
    const edit = operationFromTransaction(document, {
      label: "Rename and move",
      changes: [
        { type: "name", before: document.name, after: "Must not leak" },
        { type: "shape", index: 1, before: b, after: { ...b, x: 300 } },
      ],
    });
    const changed = applyTransaction(document, shapeTransaction("Move B", 1, b, { ...b, y: 20 })!);
    expect(() => applyOperation(changed, edit)).toThrow("changed");
    expect(changed.name).toBe("Untitled board");
  });

  it("rejects insertion when its explicit anchor disappeared", () => {
    const document = initial();
    const operation = operationFromTransaction(
      document,
      shapeTransaction("Insert", 1, null, { ...a, id: "c" })!,
    );
    const changed = applyTransaction(document, deleteObjectsTransaction(document, [b.id])!);
    expect(() => applyOperation(changed, operation)).toThrow("anchor");
  });
});
