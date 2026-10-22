import { expect, it } from "vite-plus/test";
import type { BoardDocument } from "@hydraw/document";
import { exportSvg } from "./svg-export.ts";

const document: BoardDocument = {
  format: "hydraw",
  version: 8,
  name: "Export test",
  shapes: [
    {
      id: "node<&",
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      fill: "#f7e4ed",
      kind: "ellipse",
      label: { text: "Node <A & B>", fontSize: 16, fontWeight: 700, color: "#243e33" },
    },
    {
      id: "caption",
      type: "text",
      x: 120,
      y: 24,
      width: 180,
      height: 40,
      text: "A <shape> & text",
      fontSize: 16,
      fontWeight: 400,
      textAlign: "left",
      color: "#243e33",
    },
  ],
  connectors: [
    {
      id: "edge",
      type: "connector",
      start: { type: "binding", shapeId: "node<&" },
      end: { type: "point", x: 200, y: 60 },
      color: "#243e33",
      arrowhead: "arrow",
      label: { text: "Connector & text", fontSize: 12, fontWeight: 400, color: "#243e33" },
    },
  ],
};

const measureText = (text: string, style: { fontSize: number; fontWeight: 400 | 700 }) =>
  text.length * style.fontSize * (style.fontWeight === 700 ? 0.62 : 0.58);

it("exports semantic geometry, laid out text and bound connectors as SVG", () => {
  const svg = exportSvg(document, { padding: 12, background: "#fff", measureText });
  expect(svg).toContain('viewBox="-2.75 7.25 314.75 105.5"');
  expect(svg).toContain("<ellipse");
  expect(svg).toContain('cx="60" cy="60" rx="50" ry="40"');
  expect(svg).toContain("A &lt;shape&gt; &amp; text");
  expect(svg).toContain("&lt;A &amp;");
  expect(svg).toContain("B&gt;");
  expect(svg).toContain("Connector</tspan>");
  expect(svg).toContain("&amp; text</tspan>");
  expect(svg).toContain('fill="#ffffff"');
  expect(svg).toContain('d="M 110 60 L 200 60"');
  expect(svg).toContain('fill="#fff"');
});

it("exports only explicit ids while resolving selected connectors against the full board", () => {
  const svg = exportSvg(document, { ids: ["edge"], padding: 0, measureText });
  expect(svg).toContain('d="M 110 60 L 200 60"');
  expect(svg).toContain("Connector</tspan>");
  expect(svg).toContain("&amp; text</tspan>");
  expect(svg).not.toContain("<ellipse");
  expect(svg).not.toContain("Node &lt;A");
  expect(svg).not.toContain("A &lt;shape&gt;");
});

it("rejects unsafe background values", () => {
  expect(() =>
    exportSvg(document, { background: "url(https://example.test/x)", measureText }),
  ).toThrow("hex color or transparent");
});
