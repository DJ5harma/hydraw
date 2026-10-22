import { expect, it } from "vite-plus/test";
import { createDocument, makeInkShape } from "@hydraw/document";
import { exportSvg } from "./svg-export.ts";

const measureText = (text: string) => text.length * 8;
it("exports scaled freehand paths and dots with theme colors and stroke-aware bounds", () => {
  const ink = makeInkShape(
    "ink",
    [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ],
    "#202124",
    4,
  )!;
  const svg = exportSvg(
    { ...createDocument(), theme: "blueprint", shapes: [{ ...ink, width: 40, height: 40 }] },
    { measureText, padding: 0 },
  );
  expect(svg).toContain('d="M 10 20 L 50 60"');
  expect(svg).toContain('stroke="#f2f8ff"');
  expect(svg).toContain('viewBox="8 18 44 44"');
  const dot = makeInkShape("dot", [{ x: 0, y: 0 }], "#202124", 3)!;
  expect(exportSvg({ ...createDocument(), shapes: [dot] }, { measureText })).toContain(
    '<circle cx="0" cy="0" r="1.5"',
  );
});
