import { describe, expect, it } from "vite-plus/test";
import {
  applyTransaction,
  createDocument,
  decodeDocument,
  invertTransaction,
  nameTransaction,
  shapeTransaction,
} from "./index.ts";
import type { DocumentTransaction } from "./index.ts";

const first = {
  id: "a",
  type: "rectangle" as const,
  x: 10,
  y: 20,
  width: 80,
  height: 60,
  fill: "#e7eefb" as const,
};
const second = { ...first, id: "b", x: 200 };
const initial = () => decodeDocument({ ...createDocument(), shapes: [first, second] });

describe("reversible document transactions", () => {
  it("round-trips changed records while sharing untouched records", () => {
    const document = initial();
    const change = shapeTransaction("Resize", 0, first, { ...first, width: 150 })!;
    const next = applyTransaction(document, change);
    expect(next.shapes[0]?.width).toBe(150);
    expect(next.shapes[1]).toBe(document.shapes[1]);
    expect(applyTransaction(next, invertTransaction(change))).toEqual(document);
    expect(Object.isFrozen(next.shapes)).toBe(true);
    expect(Object.isFrozen(next.shapes[0])).toBe(true);
    expect(next.connectors).toBe(document.connectors);
    const renamed = applyTransaction(document, nameTransaction(document.name, "Renamed")!);
    expect(renamed.shapes).toBe(document.shapes);
    expect(renamed.connectors).toBe(document.connectors);
  });

  it("tracks identities through ordered removals, insertions and repeated updates", () => {
    const document = initial();
    const transaction: DocumentTransaction = {
      label: "Replace and move",
      changes: [
        { type: "shape", index: 0, before: first, after: null },
        { type: "shape", index: 1, before: null, after: first },
        { type: "shape", index: 1, before: first, after: { ...first, x: 50 } },
      ],
    };
    const next = applyTransaction(document, transaction);
    expect(next.shapes).toEqual([second, { ...first, x: 50 }]);
    expect(applyTransaction(next, invertTransaction(transaction))).toEqual(document);
    expect(() =>
      applyTransaction(document, {
        ...transaction,
        changes: [...transaction.changes, { type: "shape", index: 2, before: null, after: first }],
      }),
    ).toThrow("Duplicate");
    expect(document).toEqual(initial());
  });

  it("reverses a multi-change transaction in reverse order, preserving stacking order", () => {
    const transaction: DocumentTransaction = {
      label: "Reorganize",
      changes: [
        { type: "shape", index: 0, before: first, after: null },
        { type: "shape", index: 1, before: null, after: { ...first, id: "c" } },
        { type: "name", before: "Untitled board", after: "A new name" },
      ],
    };
    const document = initial();
    const next = applyTransaction(document, transaction);
    expect(next.shapes.map((shape) => shape.id)).toEqual(["b", "c"]);
    expect(next.name).toBe("A new name");
    expect(applyTransaction(next, invertTransaction(transaction))).toEqual(document);
  });

  it("rejects an entire transaction on a later failure and does not mutate its input", () => {
    const document = initial();
    const transaction: DocumentTransaction = {
      label: "Invalid batch",
      changes: [
        { type: "name", before: document.name, after: "Do not apply partially" },
        { type: "shape", index: 0, before: first, after: { ...first, width: -2 } },
      ],
    };
    expect(() => applyTransaction(document, transaction)).toThrow("invalid");
    expect(document).toEqual(initial());
    expect(() =>
      applyTransaction(document, shapeTransaction("Duplicate", 1, null, first)!),
    ).toThrow("Duplicate");
    expect(() => shapeTransaction("Invalid", 0, first, { ...first, height: Infinity })).toThrow(
      "invalid",
    );
  });

  it("rejects a stale inverse instead of overwriting a later edit", () => {
    const resize = shapeTransaction("Resize", 0, first, { ...first, width: 150 })!;
    const resized = applyTransaction(initial(), resize);
    const later = applyTransaction(
      resized,
      shapeTransaction("Move", 0, resized.shapes[0]!, { ...resized.shapes[0]!, x: 100 })!,
    );
    expect(() => applyTransaction(later, invertTransaction(resize))).toThrow("changed");
    expect(later.shapes[0]).toMatchObject({ width: 150, x: 100 });
    expect(shapeTransaction("No-op", 0, first, first)).toBeNull();
    expect(nameTransaction("same", "same")).toBeNull();
  });
});
