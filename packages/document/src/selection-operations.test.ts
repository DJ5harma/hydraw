import { describe, expect, it } from "vite-plus/test";
import {
  applyTransaction,
  createDocument,
  decodeDocument,
  deleteObjectsTransaction,
  duplicateObjects,
  invertTransaction,
  MAX_SHAPES,
  translateObjects,
  updateObjectsTransaction,
} from "./index.ts";
import type { BoardDocument, Connector, Rectangle, TextShape } from "./index.ts";
const a: Rectangle = {
  id: "a",
  type: "rectangle",
  x: 100,
  y: 100,
  width: 100,
  height: 80,
  fill: "#e7eefb",
};
const b: TextShape = {
  id: "b",
  type: "text",
  x: 400,
  y: 100,
  width: 200,
  height: 42,
  text: "Text node",
  fontSize: 24,
  fontWeight: 400,
  textAlign: "left",
  color: "#243e33",
};
const external = { ...a, id: "external", x: 800 };
const edge: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "b" },
  color: "#243e33",
  arrowhead: "arrow",
};
const outside: Connector = {
  ...edge,
  id: "outside",
  end: { type: "binding", shapeId: "external" },
};
const free: Connector = {
  ...edge,
  id: "free",
  start: { type: "point", x: 30, y: 300 },
  end: { type: "point", x: 180, y: 300 },
};
const initial = () =>
  decodeDocument({
    ...createDocument(),
    shapes: [a, b, external],
    connectors: [edge, outside, free],
  });
const generator = () => {
  let next = 0;
  return () => `copy-${++next}`;
};

describe("atomic selection operations", () => {
  it("moves nodes and selected free endpoints once, preserving bindings and sharing unrelated records", () => {
    const document = initial();
    const updates = translateObjects(document, ["a", "b", "edge", "free"], { x: 40, y: 20 });
    const transaction = updateObjectsTransaction(document, "Move selection", updates)!;
    const next = applyTransaction(document, transaction);
    expect(next.shapes[0]).toMatchObject({ x: 140, y: 120 });
    expect(next.shapes[1]).toMatchObject({ x: 440, y: 120 });
    expect(next.connectors[0]).toBe(document.connectors[0]);
    expect(next.connectors[2]).toMatchObject({ start: { x: 70, y: 320 }, end: { x: 220, y: 320 } });
    expect(next.shapes[2]).toBe(document.shapes[2]);
    expect(applyTransaction(next, invertTransaction(transaction))).toEqual(document);
    expect(
      updateObjectsTransaction(
        document,
        "No-op",
        translateObjects(document, ["edge"], { x: 10, y: 10 }),
      ),
    ).toBeNull();
  });
  it("clamps the common movement delta and never stretches a group at limits", () => {
    const document = decodeDocument({
      ...createDocument(),
      shapes: [
        { ...a, x: 999_990 },
        { ...b, x: 999_900 },
      ],
      connectors: [free],
    });
    const next = applyTransaction(
      document,
      updateObjectsTransaction(
        document,
        "Move",
        translateObjects(document, ["a", "b", "free"], { x: 100, y: -200 }),
      )!,
    );
    expect(next.shapes.map((shape) => shape.x)).toEqual([1_000_000, 999_910]);
    expect(next.connectors[0]?.start).toEqual({ type: "point", x: 40, y: 100 });
  });
  it("duplicates selected nodes with internal edges and remaps the graph without external connections", () => {
    const document = initial();
    const result = duplicateObjects(document, ["a", "b"], generator());
    const next = applyTransaction(document, result.transaction!);
    expect(result.ids).toEqual(["copy-1", "copy-2", "copy-3"]);
    expect(next.shapes.slice(3)).toMatchObject([
      { id: "copy-1", x: 124, y: 124 },
      { id: "copy-2", x: 424, y: 124, text: "Text node" },
    ]);
    expect(next.connectors.slice(3)).toEqual([
      {
        ...edge,
        id: "copy-3",
        locked: false,
        zIndex: 1,
        start: { type: "binding", shapeId: "copy-1" },
        end: { type: "binding", shapeId: "copy-2" },
      },
    ]);
    expect(applyTransaction(next, invertTransaction(result.transaction!))).toEqual(document);
  });
  it("copies explicitly selected boundary edges independently of unselected nodes and moves points once", () => {
    const document = initial();
    const next = applyTransaction(
      document,
      duplicateObjects(document, ["a", "outside", "free"], generator()).transaction!,
    );
    expect(next.connectors[3]?.start).toEqual({ type: "binding", shapeId: "copy-1" });
    expect(next.connectors[3]?.end.type).toBe("point");
    expect(next.connectors[4]).toMatchObject({ start: { x: 54, y: 324 }, end: { x: 204, y: 324 } });
    const edgeOnly = applyTransaction(
      document,
      duplicateObjects(document, ["edge"], generator()).transaction!,
    );
    expect(edgeOnly.shapes).toEqual(document.shapes);
    expect(edgeOnly.connectors[3]?.start.type).toBe("point");
    expect(edgeOnly.connectors[3]?.end.type).toBe("point");
  });
  it("deletes mixed selections and incident edges once, preserving collection order through undo", () => {
    const document = initial();
    const transaction = deleteObjectsTransaction(document, ["a", "b", "edge", "free"])!;
    const next = applyTransaction(document, transaction);
    expect(next.shapes).toEqual([external]);
    expect(next.connectors).toHaveLength(0);
    expect(applyTransaction(next, invertTransaction(transaction))).toEqual(document);
  });
  it("rejects capacity and identity failures before applying any partial duplication", () => {
    const full: BoardDocument = {
      ...createDocument(),
      shapes: Array.from({ length: MAX_SHAPES }, (_, index) => ({ ...a, id: `node-${index}` })),
    };
    expect(() => duplicateObjects(full, ["node-0"], generator())).toThrow("not enough room");
    const document = initial();
    expect(() => duplicateObjects(document, ["a", "b"], () => "same")).toThrow("unique");
    expect(document).toEqual(initial());
    expect(duplicateObjects(document, [], generator()).transaction).toBeNull();
    expect(deleteObjectsTransaction(document, [])).toBeNull();
  });
});
