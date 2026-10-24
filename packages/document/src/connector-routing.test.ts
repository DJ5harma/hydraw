import { expect, it } from "vite-plus/test";
import {
  applyTransaction,
  connectorMidpoint,
  connectorTransaction,
  createDocument,
  decodeDocument,
  detachConnectorBindings,
  duplicateObjects,
  frameContents,
  invertTransaction,
  parseDocument,
  resolveConnector,
  serializeDocument,
  translateObjects,
} from "./index.ts";
import type { Connector, Rectangle } from "./index.ts";

const a: Rectangle = {
  id: "a",
  type: "rectangle",
  x: 100,
  y: 100,
  width: 100,
  height: 80,
  fill: "#ffffff",
};
const b: Rectangle = { ...a, id: "b", x: 400, y: 300 };
const edge: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "b" },
  color: "#202124",
  arrowhead: "arrow",
  route: { type: "elbow", axis: "x" },
};
const document = () => decodeDocument({ ...createDocument(), shapes: [a, b], connectors: [edge] });

it("routes axis-aligned segments from shape perimeters and follows moved shapes", () => {
  const geometry = resolveConnector(edge, [a, b]);
  expect(geometry.points).toEqual([
    { x: 200, y: 140 },
    { x: 300, y: 140 },
    { x: 300, y: 340 },
    { x: 400, y: 340 },
  ]);
  expect(connectorMidpoint(geometry)).toEqual({ x: 300, y: 240 });
  for (const axis of ["x", "y"] as const) {
    for (const kind of ["rectangle", "ellipse", "diamond"] as const) {
      const path = resolveConnector({ ...edge, route: { type: "elbow", axis } }, [
        { ...a, kind },
        { ...b, kind, x: 450 },
      ]);
      path.points
        .slice(1)
        .forEach((point, i) =>
          expect(point.x === path.points[i]!.x || point.y === path.points[i]!.y).toBe(true),
        );
    }
  }
  expect(resolveConnector(edge, [a, { ...b, x: 600 }]).end.x).toBe(600);
});

it("keeps automatic and edited trunks outside endpoint bodies, even for overlapping bounds", () => {
  const overlapping = { ...b, x: 120 };
  const geometry = resolveConnector(edge, [a, overlapping]);
  expect(geometry.bend!.point.x).toBe(236);
  expect(geometry.points[0]!.x).toBe(200);
  const edited = resolveConnector({ ...edge, route: { type: "elbow", axis: "x", position: 150 } }, [
    a,
    b,
  ]);
  expect(edited.bend!.point.x).toBe(216);
  const free = {
    ...edge,
    start: { type: "point" as const, x: 0, y: 0 },
    end: { type: "point" as const, x: 100, y: 100 },
    route: { type: "elbow" as const, axis: "y" as const, position: -80 },
  };
  expect(resolveConnector(free, []).points).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: -80 },
    { x: 100, y: -80 },
    { x: 100, y: 100 },
  ]);
});

it("validates, freezes and round-trips routing and rejects stale route edits atomically", () => {
  const before = document();
  expect(Object.isFrozen(before.connectors[0]!.route)).toBe(true);
  const after: Connector = { ...edge, route: { type: "elbow", axis: "y", position: 230 } };
  const change = connectorTransaction("Route connector", 0, edge, after)!;
  const routed = applyTransaction(before, change);
  expect(parseDocument(serializeDocument(routed))).toEqual(routed);
  expect(applyTransaction(routed, invertTransaction(change))).toEqual(before);
  expect(() => applyTransaction(routed, change)).toThrow();
  expect(connectorTransaction("No change", 0, after, { ...after })).toBeNull();
  for (const route of [
    { type: "curve", axis: "x" },
    { type: "elbow", axis: "z" },
    { type: "elbow", axis: "x", position: NaN },
    { type: "elbow", axis: "y", position: 2_000_001 },
  ]) {
    expect(() => decodeDocument({ ...before, connectors: [{ ...edge, route }] })).toThrow(
      "routing",
    );
  }
});

it("preserves routed geometry on detach, translation and fresh-ID duplication", () => {
  const before = document();
  const manual = { ...edge, route: { type: "elbow" as const, axis: "x" as const, position: 700 } };
  const detached = detachConnectorBindings(manual, before.shapes);
  expect(resolveConnector(detached, []).points).toEqual(
    resolveConnector(manual, before.shapes).points,
  );
  const scene = { ...before, connectors: [manual] };
  const moved = translateObjects(scene, ["a", "b", "edge"], { x: 20, y: -30 });
  expect(resolveConnector(moved.connectors[0]!, moved.shapes).points).toEqual(
    resolveConnector(manual, before.shapes).points.map((point) => ({
      x: point.x + 20,
      y: point.y - 30,
    })),
  );
  let id = 0;
  const duplicate = duplicateObjects(scene, ["edge"], () => `new-${++id}`);
  const cloned = applyTransaction(scene, duplicate.transaction!);
  expect(resolveConnector(cloned.connectors[1]!, cloned.shapes).points).toEqual(
    resolveConnector(manual, before.shapes).points.map((point) => ({
      x: point.x + 24,
      y: point.y + 24,
    })),
  );
});

it("excludes a route that leaves a frame even when both endpoints are enclosed", () => {
  const frame: Rectangle = {
    ...a,
    id: "frame",
    kind: "frame",
    x: 0,
    y: 0,
    width: 600,
    height: 600,
  };
  const scene = {
    ...document(),
    shapes: [a, b, frame],
    connectors: [{ ...edge, route: { type: "elbow" as const, axis: "x" as const, position: 700 } }],
  };
  expect(frameContents(scene, "frame")).toEqual(["a", "b"]);
});

it("clamps manual route movement using stored coordinates even when the displayed trunk is displaced", () => {
  const scene = {
    ...document(),
    shapes: [
      { ...a, x: 1_000_000 },
      { ...b, x: 1_000_000 },
    ],
    connectors: [
      { ...edge, route: { type: "elbow" as const, axis: "x" as const, position: 1_000_000 } },
    ],
  };
  const moved = translateObjects(scene, ["edge"], { x: 2_000_000, y: 0 });
  expect(moved.connectors[0]!.route!.position).toBe(2_000_000);
  expect(() => decodeDocument({ ...scene, connectors: moved.connectors })).not.toThrow();
});
