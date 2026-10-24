import { expect, it } from "vite-plus/test";
import {
  applyTransaction,
  createDocument,
  decodeDocument,
  MAX_BOARD_INK_POINTS,
  makeInkShape,
  parseDocument,
  serializeDocument,
  shapeTransaction,
} from "./index.ts";

const stroke = makeInkShape(
  "stroke",
  [
    { x: 10, y: 10 },
    { x: 30, y: 20 },
    { x: 50, y: 10 },
  ],
  "#202124",
  3,
)!;

it("round trips ink and rejects invalid samples", () => {
  const document = decodeDocument({ ...createDocument(), shapes: [stroke] });
  expect(parseDocument(serializeDocument(document))).toEqual(document);
  for (const points of [
    [],
    [{ x: NaN, y: 0 }],
    [{ x: 1.1, y: 0 }],
    Array.from({ length: 4097 }, () => ({ x: 0, y: 0 })),
  ]) {
    expect(() => decodeDocument({ ...document, shapes: [{ ...stroke, points }] })).toThrow(
      "freehand",
    );
  }
});

it("enforces a board point budget through imports and transactions without changing the source", () => {
  const points = Array.from({ length: 4000 }, (_, i) => ({ x: i / 4000, y: 0 }));
  const shapes = Array.from({ length: MAX_BOARD_INK_POINTS / 4000 }, (_, i) => ({
    ...stroke,
    id: `stroke-${i}`,
    points,
  }));
  const full = decodeDocument({ ...createDocument(), shapes });
  const next = { ...stroke, id: "one-too-many", points: [{ x: 0, y: 0 }] };
  expect(() => decodeDocument({ ...full, shapes: [...full.shapes, next] })).toThrow("point limit");
  const transaction = shapeTransaction("Draw", shapes.length, null, next)!;
  expect(() => applyTransaction(full, transaction)).toThrow("point limit");
  expect(full.shapes).toHaveLength(shapes.length);
});
