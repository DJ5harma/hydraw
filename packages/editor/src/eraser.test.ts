import { describe, expect, it } from "vite-plus/test";
import { makeInkShape } from "@hydraw/document";
import { hitEraserShape, hitInkStroke } from "./eraser.ts";

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

it("uses ellipse and diamond geometry instead of erasing empty bounding-box corners", () => {
  const base = {
    id: "shape",
    type: "rectangle" as const,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fill: "transparent" as const,
  };
  for (const kind of ["ellipse", "diamond"] as const) {
    const shape = { ...base, kind };
    expect(hitEraserShape(shape, { x: 0, y: 0 }, { x: 5, y: 5 }, 2)).toBe(false);
    expect(hitEraserShape(shape, { x: -20, y: 50 }, { x: 120, y: 50 }, 2)).toBe(true);
    expect(hitEraserShape(shape, { x: 50, y: 50 }, { x: 50, y: 50 }, 2)).toBe(true);
  }
  expect(hitEraserShape({ ...base, kind: "frame" }, { x: 50, y: 50 }, { x: 60, y: 50 }, 2)).toBe(
    false,
  );
});
