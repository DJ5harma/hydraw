import { describe, expect, it } from "vite-plus/test";
import { makeInkShape } from "@hydraw/document";
import { hitInkStroke } from "./eraser.ts";

describe("swept ink erasing", () => {
  it("catches strokes between fast pointer samples and a crossing stroke", () => {
    const stroke = makeInkShape(
      "stroke",
      [
        { x: 50, y: -20 },
        { x: 50, y: 20 },
      ],
      "#202124",
      2,
    )!;
    expect(hitInkStroke(stroke, { x: 0, y: 0 }, { x: 100, y: 0 }, 4)).toBe(true);
  });

  it("uses the actual polyline, preserving empty parts of its bounds", () => {
    const stroke = makeInkShape(
      "stroke",
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      "#202124",
      2,
    )!;
    expect(hitInkStroke(stroke, { x: 45, y: 45 }, { x: 55, y: 55 }, 2)).toBe(false);
    expect(hitInkStroke(stroke, { x: 45, y: 0 }, { x: 55, y: 0 }, 2)).toBe(true);
  });
});
