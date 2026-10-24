import { describe, expect, it } from "vite-plus/test";
import {
  applyTransaction,
  connectorTransaction,
  createConnectorResolver,
  createDocument,
  decodeDocument,
  deleteShapeTransaction,
  distanceToSegment,
  invertTransaction,
  resolveConnector,
  shapeTransaction,
} from "./index.ts";
import type { Connector, Rectangle } from "./index.ts";

const a: Rectangle = {
  id: "a",
  type: "rectangle",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill: "#e7eefb",
};
const b: Rectangle = { ...a, id: "b", x: 300 };
const connector: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "b" },
  color: "#243e33",
  arrowhead: "arrow",
};
const initial = () =>
  decodeDocument({ ...createDocument(), shapes: [a, b], connectors: [connector] });

describe("bound connector documents", () => {
  it("resolves indexed scenes with current bounds and the same geometry as individual edges", () => {
    const moved = { ...b, x: 500, width: 240 };
    const resolve = createConnectorResolver([a, moved]);
    expect(resolve(connector)).toEqual(resolveConnector(connector, [a, moved]));
    expect(resolve(connector)).not.toEqual(resolveConnector(connector, [a, b]));
    const free: Connector = { ...connector, start: { type: "point", x: 100, y: 20 } };
    expect(resolve(free)).toEqual(resolveConnector(free, [a, moved]));
    expect(() => createConnectorResolver([a])(connector)).toThrow("missing");
  });
  it("round-trips endpoint semantics", () => {
    const document = initial();
    expect(decodeDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
    expect(Object.isFrozen(document.connectors[0]?.start)).toBe(true);
  });
  it("rejects dangling, duplicate, self-bound and malformed connector records", () => {
    for (const patch of [
      { id: "a" },
      { start: { type: "binding", shapeId: "missing" } },
      { end: connector.start },
      { start: { type: "point", x: Infinity, y: 0 } },
      { color: "red" },
      { arrowhead: "unsupported" },
    ])
      expect(() =>
        decodeDocument({ ...initial(), connectors: [{ ...connector, ...patch }] }),
      ).toThrow();
    expect(() => decodeDocument({ ...initial(), connectors: [connector, connector] })).toThrow(
      "duplicate",
    );
  });
  it("derives perimeter attachments after moves, resizing, vertical routing and coincident centers", () => {
    expect(resolveConnector(connector, [a, b])).toEqual({
      start: { x: 100, y: 50 },
      end: { x: 300, y: 50 },
    });
    expect(resolveConnector(connector, [a, { ...b, x: 0, y: 300 }])).toEqual({
      start: { x: 50, y: 100 },
      end: { x: 50, y: 300 },
    });
    expect(resolveConnector(connector, [{ ...a, width: 200 }, b]).start).toEqual({ x: 200, y: 50 });
    expect(resolveConnector(connector, [a, { ...b, x: 0 }])).toEqual({
      start: { x: 100, y: 50 },
      end: { x: 0, y: 50 },
    });
    expect(distanceToSegment({ x: 150, y: 53 }, { x: 100, y: 50 }, { x: 300, y: 50 })).toBe(3);
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
  it("cascades incident edges in stacking order and restores everything through one inverse", () => {
    const unrelated: Connector = {
      ...connector,
      id: "other",
      start: { type: "point", x: 10, y: 20 },
      end: { type: "point", x: 30, y: 40 },
    };
    const document = decodeDocument({
      ...initial(),
      connectors: [connector, unrelated, { ...connector, id: "edge-2" }],
    });
    const transaction = deleteShapeTransaction(document, "a")!;
    const next = applyTransaction(document, transaction);
    expect(next.shapes).toEqual([b]);
    expect(next.connectors).toEqual([unrelated]);
    expect(applyTransaction(next, invertTransaction(transaction))).toEqual(document);
    expect(() =>
      applyTransaction(document, shapeTransaction("Unsafe deletion", 0, a, null)!),
    ).toThrow("missing");
  });
  it("validates the final graph atomically and protects inverse connector edits from stale state", () => {
    const document = initial();
    const change = connectorTransaction("Color", 0, connector, { ...connector, color: "#3568db" })!;
    const next = applyTransaction(document, change);
    expect(applyTransaction(next, invertTransaction(change))).toEqual(document);
    expect(() => applyTransaction(next, change)).toThrow("changed");
    expect(() =>
      applyTransaction(
        document,
        connectorTransaction("Bad binding", 0, connector, {
          ...connector,
          end: { type: "binding", shapeId: "missing" },
        })!,
      ),
    ).toThrow("missing");
    expect(document).toEqual(initial());
    expect(connectorTransaction("No-op", 0, connector, connector)).toBeNull();
  });
});
