import { describe, expect, it } from "vite-plus/test";
import { createDocument, resolveConnector } from "@hydraw/document";
import type { Connector, ImageShape } from "@hydraw/document";
import { exportSvg } from "./svg-export.ts";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const image: ImageShape = {
  id: "image",
  type: "image",
  src: png,
  name: "image.png",
  x: 20,
  y: 30,
  width: 100,
  height: 80,
  crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
};
const connector: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: image.id },
  end: { type: "point", x: 250, y: 80 },
  color: "#243e33",
  arrowhead: "arrow",
};

describe("cropped image rendering", () => {
  it("clips SVG to the same source-normalized region while embedding the unchanged PNG", () => {
    const svg = exportSvg(
      { ...createDocument(), shapes: [image] },
      {
        measureText: (text, style) => text.length * style.fontSize,
      },
    );
    expect(svg).toContain('viewBox="0.25 0.25 0.5 0.5"');
    expect(svg).toContain('width="1" height="1"');
    expect(svg).toContain(`href="${png}"`);
  });

  it("keeps a bound connector attached to the visible image boundary", () => {
    const boundsBefore = resolveConnector(connector, [image]);
    const largerCrop = {
      ...image,
      x: 20,
      y: 30,
      width: 160,
      height: 120,
      crop: { x: 0, y: 0, width: 0.8, height: 0.75 },
    };
    const boundsAfter = resolveConnector(connector, [largerCrop]);
    expect(boundsBefore.start).not.toEqual(boundsAfter.start);
    expect(boundsAfter.start.x).toBeCloseTo(180);
    expect(boundsAfter.start.y).toBeCloseTo(84.6667);
  });
});
