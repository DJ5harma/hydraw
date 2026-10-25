import { describe, expect, it } from "vite-plus/test";
import {
  applyTransaction,
  createDocument,
  insertPreset,
  planTransaction,
  PRESETS,
} from "./index.ts";

describe("document presets", () => {
  it("inserts each editable three-node graph at the requested center as one group", () => {
    for (const [index, preset] of PRESETS.entries()) {
      let nextId = 0;
      const result = insertPreset(
        createDocument(),
        preset.id,
        { x: 500, y: 300 },
        () => `id-${index}-${nextId++}`,
      );
      expect(result.transaction).not.toBeNull();
      const document = applyTransaction(createDocument(), result.transaction!);
      expect(result.ids).toHaveLength(5);
      expect(
        document.shapes.map((shape) =>
          shape.type === "rectangle" ? shape.label?.text : undefined,
        ),
      ).toEqual(preset.description.split(" → "));
      expect(document.shapes.map((shape) => shape.x + shape.width / 2)).toEqual([220, 500, 780]);
      expect(
        document.shapes.every((shape) => shape.groupId === document.connectors[0]?.groupId),
      ).toBe(true);
      expect(
        document.connectors.every((connector) => connector.groupId === document.shapes[0]?.groupId),
      ).toBe(true);
      expect(document.connectors.map((connector) => [connector.start, connector.end])).toEqual([
        [
          { type: "binding", shapeId: document.shapes[0]!.id },
          { type: "binding", shapeId: document.shapes[1]!.id },
        ],
        [
          { type: "binding", shapeId: document.shapes[1]!.id },
          { type: "binding", shapeId: document.shapes[2]!.id },
        ],
      ]);
      expect(
        applyTransaction(document, planTransaction(createDocument(), result.transaction!).inverse),
      ).toEqual(createDocument());
    }
  });

  it("rejects ID collisions and placements beyond document bounds", () => {
    expect(() =>
      insertPreset(createDocument(), "request-flow", { x: 0, y: 0 }, () => "same"),
    ).toThrow(/unique/);
    expect(() =>
      insertPreset(
        createDocument(),
        "request-flow",
        { x: 1_000_000, y: 0 },
        (() => {
          let id = 0;
          return () => `id-${id++}`;
        })(),
      ),
    ).toThrow(/board area/);
  });

  it("places the connected graph above sparse high ranks while keeping connectors behind nodes", () => {
    const board = {
      ...createDocument(),
      shapes: [
        {
          id: "low",
          type: "rectangle" as const,
          x: 0,
          y: 0,
          width: 20,
          height: 20,
          fill: "#ffffff" as const,
          zIndex: 12,
        },
        {
          id: "high",
          type: "rectangle" as const,
          x: 30,
          y: 0,
          width: 20,
          height: 20,
          fill: "#ffffff" as const,
          zIndex: 700_000_000,
        },
      ],
    };
    let nextId = 0;
    const result = insertPreset(
      board,
      "async-worker",
      { x: 500, y: 300 },
      () => `rank-${nextId++}`,
    );
    const after = applyTransaction(board, result.transaction!);
    const insertedShapes = after.shapes.slice(board.shapes.length);
    const insertedConnectors = after.connectors;
    expect(
      Math.min(...[...insertedShapes, ...insertedConnectors].map((object) => object.zIndex!)),
    ).toBeGreaterThan(700_000_000);
    expect(Math.max(...insertedConnectors.map((connector) => connector.zIndex!))).toBeLessThan(
      Math.min(...insertedShapes.map((shape) => shape.zIndex!)),
    );
  });
});
