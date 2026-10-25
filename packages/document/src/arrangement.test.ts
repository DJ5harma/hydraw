import { describe, expect, it } from "vite-plus/test";
import {
  alignShapesTransaction,
  applyTransaction,
  createDocument,
  decodeDocument,
  distributeShapesTransaction,
  planTransaction,
} from "./index.ts";
import type { Alignment, Connector, Rectangle, TextShape } from "./index.ts";
const a: Rectangle = {
  id: "a",
  type: "rectangle",
  x: 100,
  y: 80,
  width: 100,
  height: 80,
  fill: "#e7eefb",
};
const b: Rectangle = { ...a, id: "b", x: 400, y: 280, width: 200, height: 100 };
const text: TextShape = {
  id: "text",
  type: "text",
  text: "Keep the content",
  x: 260,
  y: 180,
  width: 120,
  height: 42,
  fontSize: 24,
  fontWeight: 700,
  textAlign: "center",
  color: "#243e33",
};
const outside: Rectangle = { ...a, id: "outside", x: 900, y: 600 };
const edge: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "b" },
  color: "#243e33",
  arrowhead: "arrow",
};
const initial = () =>
  decodeDocument({ ...createDocument(), shapes: [a, b, text, outside], connectors: [edge] });
const ids = ["a", "b", "text", "edge"];

describe("selection arrangement", () => {
  const cases: [Alignment, "x" | "y", number[]][] = [
    ["left", "x", [100, 100, 100]],
    ["horizontal-center", "x", [300, 250, 290]],
    ["right", "x", [500, 400, 480]],
    ["top", "y", [80, 80, 80]],
    ["vertical-center", "y", [190, 180, 209]],
    ["bottom", "y", [300, 280, 338]],
  ];
  for (const [alignment, axis, expected] of cases)
    it(`aligns ${alignment} against selected node bounds in one reversible transaction`, () => {
      const document = initial();
      const transaction = alignShapesTransaction(document, ids, alignment)!;
      const next = applyTransaction(document, transaction);
      expect(next.shapes.slice(0, 3).map((shape) => shape[axis])).toEqual(expected);
      expect(next.shapes[3]).toBe(document.shapes[3]);
      expect(next.connectors[0]).toBe(document.connectors[0]);
      expect(next.shapes[2]).toMatchObject({
        text: text.text,
        fontSize: text.fontSize,
        fontWeight: text.fontWeight,
        color: text.color,
        width: text.width,
        height: text.height,
      });
      expect(applyTransaction(next, planTransaction(document, transaction).inverse)).toEqual(
        document,
      );
      expect(alignShapesTransaction(next, ids, alignment)).toBeNull();
    });
  it("distributes centers with variable dimensions while preserving outer nodes and document stacking order", () => {
    const document = initial();
    const next = applyTransaction(
      document,
      distributeShapesTransaction(document, ids, "horizontal")!,
    );
    expect(next.shapes.map((shape) => shape.id)).toEqual(document.shapes.map((shape) => shape.id));
    expect(next.shapes.slice(0, 3).map((shape) => shape.x)).toEqual([100, 400, 265]);
    expect(next.shapes[0]).toBe(document.shapes[0]);
    expect(next.shapes[1]).toBe(document.shapes[1]);
    expect(distributeShapesTransaction(next, ids, "horizontal")).toBeNull();
    const vertical = applyTransaction(
      document,
      distributeShapesTransaction(document, ids, "vertical")!,
    );
    expect(vertical.shapes.slice(0, 3).map((shape) => shape.y)).toEqual([80, 280, 204]);
    expect(vertical.connectors).toEqual(document.connectors);
  });
  it("handles tied and fractional centers deterministically without resizing nodes", () => {
    const document = decodeDocument({
      ...createDocument(),
      shapes: [
        { ...a, x: 0 },
        { ...b, x: -50 },
        { ...a, id: "c", x: 200.5 },
        { ...a, id: "d", x: 400 },
      ],
    });
    const transaction = distributeShapesTransaction(document, ["a", "b", "c", "d"], "horizontal")!;
    const next = applyTransaction(document, transaction);
    expect(next.shapes[0]?.x).toBe(0);
    expect(next.shapes[1]?.x).toBeCloseTo(83.3333333333);
    expect(next.shapes[2]?.x).toBeCloseTo(266.6666666667);
    expect(next.shapes[3]?.x).toBe(400);
    expect(applyTransaction(next, planTransaction(document, transaction).inverse)).toEqual(
      document,
    );
  });
  it("does not add history for repeated layouts with fractional bounds", () => {
    const document = decodeDocument({
      ...createDocument(),
      shapes: Array.from({ length: 3 }, (_, index) => ({
        ...a,
        id: String(index),
        x: index * 7.31,
        y: index * 0.71,
        width: 10.19 + index * 37.53,
        height: 15.19 + index * 23.87,
      })),
    });
    for (const alignment of [
      "left",
      "horizontal-center",
      "right",
      "top",
      "vertical-center",
      "bottom",
    ] as const) {
      const transaction = alignShapesTransaction(document, ["0", "1", "2"], alignment)!;
      const next = applyTransaction(document, transaction);
      expect(alignShapesTransaction(next, ["0", "1", "2"], alignment)).toBeNull();
    }
  });

  it("keeps repeated layouts stable when large operands cancel to origins near zero", () => {
    const document = decodeDocument({
      ...createDocument(),
      shapes: [
        {
          ...a,
          id: "0",
          x: -32666.88651752335,
          y: -76088.58694521751,
          width: 99990.194,
          height: 99990.138,
        },
        { ...a, id: "1", x: 0, y: 0, width: 100.001, height: 100.001 },
        {
          ...a,
          id: "2",
          x: 32666.88651752335,
          y: 76088.58694521751,
          width: 99990.194,
          height: 99990.138,
        },
      ],
    });
    for (const alignment of ["horizontal-center", "right", "vertical-center", "bottom"] as const) {
      const next = applyTransaction(
        document,
        alignShapesTransaction(document, ["0", "1", "2"], alignment)!,
      );
      expect(alignShapesTransaction(next, ["0", "1", "2"], alignment)).toBeNull();
    }
  });

  it("ignores connector identities and insufficient node selections without creating history", () => {
    const document = initial();
    expect(alignShapesTransaction(document, ["a", "edge", "missing"], "left")).toBeNull();
    expect(distributeShapesTransaction(document, ["a", "b", "edge"], "horizontal")).toBeNull();
  });

  it("enforces lock, group and frame restrictions at the document boundary", () => {
    for (const metadata of [{ locked: true }, { groupId: "group" }, { kind: "frame" as const }]) {
      const source = initial();
      const document = decodeDocument({
        ...source,
        connectors: [],
        shapes: source.shapes.map((shape) =>
          shape.id === "a" ? { ...shape, ...metadata } : shape,
        ),
      });
      expect(alignShapesTransaction(document, ["a", "b", "c"], "left")).toBeNull();
      expect(distributeShapesTransaction(document, ["a", "b", "c"], "horizontal")).toBeNull();
    }
  });
  it("rejects an out-of-range layout as a whole instead of clamping away the alignment", () => {
    const document = decodeDocument({
      ...createDocument(),
      shapes: [
        { ...a, x: 1_000_000, width: 100_000 },
        { ...b, x: 900_000, width: 100 },
      ],
    });
    expect(() => alignShapesTransaction(document, ["a", "b"], "right")).toThrow("coordinate limit");
    expect(document.shapes[1]?.x).toBe(900_000);
  });
});
