import { describe, expect, it } from "vite-plus/test";
import { hitTestInk, makeInkShape, MAX_INK_POINTS, recognizeInk } from "./ink.ts";
import type { Point } from "./model.ts";

function sample(points: readonly Point[]) {
  return makeInkShape("ink-1", points, "#243e33", 2)!;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, count = 64): Point[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

describe("freehand geometry", () => {
  it("stores normalized points and caps sample count", () => {
    const points = Array.from({ length: MAX_INK_POINTS + 10 }, (_, x) => ({
      x,
      y: Math.sin(x) * 4,
    }));
    const ink = sample(points)!;
    expect(ink.points).toHaveLength(MAX_INK_POINTS);
    expect(ink.points.every(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
  });

  it("retains sharp turns when reducing long paths", () => {
    const points = Array.from({ length: MAX_INK_POINTS + 200 }, (_, i) =>
      i < 100 ? { x: i, y: 0 } : i < 200 ? { x: 100, y: i - 100 } : { x: 300 + i, y: 100 },
    );
    const ink = sample(points);
    expect(ink.points).toHaveLength(MAX_INK_POINTS);
    expect(ink.points.some(({ x, y }) => x === 100 / ink.width && y === 0)).toBe(true);
    expect(ink.points.some(({ x, y }) => x === 100 / ink.width && y === 99 / ink.height)).toBe(
      true,
    );
  });

  it("accepts horizontal strokes and rejects out-of-range coordinates", () => {
    expect(
      makeInkShape(
        "line",
        [
          { x: 3, y: 7 },
          { x: 9, y: 7 },
        ],
        "#243e33",
        2,
      ),
    ).toMatchObject({ width: 6, height: 1 });
    expect(
      makeInkShape(
        "huge",
        [
          { x: 0, y: 0 },
          { x: 1_000_001, y: 0 },
        ],
        "#243e33",
        2,
      ),
    ).toBeNull();
    const dot = makeInkShape("dot", [{ x: 3, y: 7 }], "#243e33", 2)!;
    expect(hitTestInk(dot, { x: 3, y: 7 })).toBe(true);
    expect(hitTestInk(dot, { x: 5, y: 7 })).toBe(false);
  });

  it("hits the path itself instead of its empty bounding-box interior", () => {
    const ink = sample([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(hitTestInk(ink, { x: 50, y: 1 })).toBe(true);
    expect(hitTestInk(ink, { x: 50, y: 50 })).toBe(false);
  });

  it("recognizes a closed rectangle and ellipse, while rejecting open paths", () => {
    const rectangle = sample([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 70, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 30 },
      { x: 100, y: 70 },
      { x: 100, y: 100 },
      { x: 70, y: 100 },
      { x: 30, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 70 },
      { x: 0, y: 30 },
      { x: 0, y: 0 },
    ]);
    expect(recognizeInk(rectangle)).toMatchObject({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: "transparent",
      appearance: { stroke: "#243e33", strokeWidth: 2 },
    });
    expect(recognizeInk(sample(ellipse(40, 30, 40, 30)))).toMatchObject({
      kind: "ellipse",
      x: 0,
      y: 0,
      width: 80,
      height: 60,
    });
    expect(
      recognizeInk(
        sample([
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 10 },
          { x: 30, y: 10 },
        ]),
      ),
    ).toBeNull();
    expect(
      recognizeInk(
        sample([
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
          { x: 0, y: 0 },
        ]),
      ),
    ).toBeNull();
  });
});
