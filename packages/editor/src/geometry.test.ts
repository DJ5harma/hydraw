import { describe, expect, it } from "vite-plus/test";
import { decodeRectangle, MAX_COORDINATE, MAX_SIZE } from "@hydraw/document";
import { handlePoint, hitResizeHandle, RESIZE_HANDLES, resizeRectangle } from "./geometry.ts";
import type { ResizeHandle } from "./geometry.ts";

const shape = {
  id: "a",
  type: "rectangle" as const,
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  fill: "#e7eefb" as const,
};

describe("rectangle resize geometry", () => {
  const cases: [ResizeHandle, number, number, number, number, number, number][] = [
    ["nw", 80, 70, 80, 70, 220, 130],
    ["n", 200, 70, 100, 70, 200, 130],
    ["ne", 350, 70, 100, 70, 250, 130],
    ["e", 350, 150, 100, 100, 250, 100],
    ["se", 350, 240, 100, 100, 250, 140],
    ["s", 200, 240, 100, 100, 200, 140],
    ["sw", 80, 240, 80, 100, 220, 140],
    ["w", 80, 150, 80, 100, 220, 100],
  ];
  it.each(cases)("anchors opposite edges for %s", (handle, px, py, x, y, width, height) => {
    expect(resizeRectangle(shape, handle, { x: px, y: py })).toMatchObject({ x, y, width, height });
  });
  it("crosses opposite edges with positive sizes and enforces minimum dimensions", () => {
    expect(resizeRectangle(shape, "se", { x: 50, y: 60 })).toMatchObject({
      x: 50,
      y: 60,
      width: 50,
      height: 40,
    });
    expect(resizeRectangle(shape, "nw", { x: 300, y: 200 })).toMatchObject({ width: 1, height: 1 });
  });
  it("keeps handle hit targets in screen pixels and chooses the closest overlapping target", () => {
    for (const zoom of [0.1, 1, 4]) {
      const camera = { x: 40, y: 30, zoom };
      for (const handle of RESIZE_HANDLES) {
        const point = handlePoint(shape, handle);
        expect(
          hitResizeHandle(shape, { x: point.x * zoom + 40, y: point.y * zoom + 30 }, camera),
        ).toBe(handle);
      }
    }
    expect(hitResizeHandle(shape, { x: 340, y: 200 }, { x: 0, y: 0, zoom: 1 })).toBeNull();
  });
  it("produces schema-valid geometry at document limits", () => {
    for (const x of [-MAX_COORDINATE, MAX_COORDINATE]) {
      for (const handle of RESIZE_HANDLES) {
        for (const point of [
          { x: -1e20, y: -1e20 },
          { x: 1e20, y: 1e20 },
        ]) {
          const resized = resizeRectangle(
            { ...shape, x, y: x, width: MAX_SIZE, height: MAX_SIZE },
            handle,
            point,
          );
          expect(() => decodeRectangle(resized)).not.toThrow();
        }
      }
    }
  });
});
