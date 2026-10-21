import { describe, expect, it } from "vite-plus/test";
import { createDocument, decodeDocument } from "@hydraw/document";
import type { BoardDocument, Rectangle } from "@hydraw/document";
import { snapTranslation } from "./snapping.ts";

const rect = (id: string, x: number, y: number, width = 100, height = 60): Rectangle => ({
  id,
  type: "rectangle",
  x,
  y,
  width,
  height,
  fill: "#e7eefb",
});
const board = (shapes: readonly Rectangle[]): BoardDocument =>
  decodeDocument({ ...createDocument(), shapes });

describe("selection smart guides", () => {
  it("snaps the whole selection to a peer edge within six screen pixels", () => {
    const result = snapTranslation(
      board([rect("moving", 0, 0), rect("peer", 200, 100)]),
      ["moving"],
      { x: 96, y: 40 },
      1,
    );
    expect(result.delta).toEqual({ x: 100, y: 40 });
    expect(result.guides).toContainEqual(
      expect.objectContaining({ axis: "x", position: 200, kind: "align" }),
    );
  });

  it("uses the nearest deterministic alignment at the requested zoom tolerance", () => {
    const document = board([rect("moving", 0, 0), rect("peer", 100, 200)]);
    const result = snapTranslation(document, ["moving"], { x: 1, y: 1 }, 2);
    expect(result.delta.x).toBe(0);
    expect(result.guides.some((guide) => guide.axis === "x" && guide.position === 100)).toBe(true);
    expect(snapTranslation(document, ["moving"], { x: 3.1, y: 1 }, 2).delta.x).toBe(3.1);
  });

  it("snaps into equal spacing between neighboring peers", () => {
    const result = snapTranslation(
      board([rect("left", 0, 0), rect("moving", 205, 0), rect("right", 400, 0)]),
      ["moving"],
      { x: -5, y: 0 },
      1,
    );
    expect(result.delta.x).toBe(-5);
    expect(result.guides).toContainEqual(
      expect.objectContaining({ axis: "x", kind: "spacing", gap: 100 }),
    );
  });

  it("repeats a neighboring gap after the second peer", () => {
    const result = snapTranslation(
      board([rect("first", 0, 0), rect("second", 200, 0), rect("moving", 398, 0)]),
      ["moving"],
      { x: 0, y: 0 },
      1,
    );
    expect(result.delta.x).toBe(2);
    expect(result.guides).toContainEqual(
      expect.objectContaining({
        axis: "x",
        kind: "spacing",
        gap: 100,
        segments: [
          { start: 100, end: 200, cross: 30 },
          { start: 300, end: 400, cross: 30 },
        ],
      }),
    );
  });

  it("does not use spacing peers from a separate row", () => {
    const result = snapTranslation(
      board([rect("first", 0, 400), rect("second", 200, 400), rect("moving", 398, 0)]),
      ["moving"],
      { x: 0, y: 0 },
      1,
    );
    expect(result.guides.some((guide) => guide.kind === "spacing")).toBe(false);
  });

  it("ignores selected objects as targets and connector geometry", () => {
    const document = decodeDocument({
      ...createDocument(),
      shapes: [rect("moving", 0, 0), rect("peer", 200, 0)],
      connectors: [
        {
          id: "edge",
          type: "connector",
          start: { type: "point", x: 100, y: 10 },
          end: { type: "point", x: 101, y: 10 },
          color: "#243e33",
          arrowhead: "none",
        },
      ],
    });
    const result = snapTranslation(document, ["moving", "peer", "edge"], { x: 0, y: 0 }, 1);
    expect(result.guides).toEqual([]);
    expect(result.delta).toEqual({ x: 0, y: 0 });
  });
});
