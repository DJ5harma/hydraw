import { expect, it } from "vite-plus/test";
import {
  createDocument,
  decodeDocument,
  isHexColor,
  parseHexColor,
  serializeDocument,
  parseDocument,
  themedShape,
  themedConnector,
  makeInkShape,
  rectangleAppearance,
} from "./index.ts";
it("parses friendly hex input and rejects CSS, alpha and malformed colors", () => {
  expect(parseHexColor(" A3f ")).toBe("#aa33ff");
  expect(parseHexColor("#12ABef")).toBe("#12abef");
  for (const value of ["red", "#abcd", "#12345678", "url(x)", "", "#gggggg"])
    expect(parseHexColor(value)).toBeNull();
  expect(isHexColor("#123456")).toBe(true);
  expect(isHexColor("#abc")).toBe(false);
});
it("round-trips custom fill, stroke, text, label, connector and ink colors in canonical form", () => {
  const source = {
    ...createDocument(),
    shapes: [
      {
        id: "a",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        fill: "#12ABEF",
        appearance: {
          stroke: "#AB1298",
          strokeWidth: 2,
          strokeStyle: "solid",
          opacity: 100,
          cornerRadius: 8,
        },
        label: { text: "Label", fontSize: 16, fontWeight: 400, color: "#FED123" },
      },
      {
        id: "t",
        type: "text",
        x: 200,
        y: 0,
        width: 100,
        height: 80,
        text: "Note",
        fontSize: 16,
        fontWeight: 400,
        textAlign: "left",
        color: "#4512EF",
      },
      makeInkShape(
        "ink",
        [
          { x: 0, y: 200 },
          { x: 100, y: 220 },
        ],
        "#78abce",
        3,
      ),
    ],
    connectors: [
      {
        id: "edge",
        type: "connector",
        start: { type: "point", x: 0, y: 300 },
        end: { type: "point", x: 100, y: 300 },
        color: "#FED987",
        arrowhead: "arrow",
      },
    ],
  };
  const document = decodeDocument(source);
  expect(document.shapes[0]).toMatchObject({
    fill: "#12abef",
    appearance: { stroke: "#ab1298" },
    label: { color: "#fed123" },
  });
  expect(document.shapes[1]).toMatchObject({ color: "#4512ef" });
  expect(document.connectors[0]!.color).toBe("#fed987");
  expect(parseDocument(serializeDocument(document))).toEqual(document);
  for (const theme of ["notebook", "blueprint"] as const) {
    const shape = themedShape(document.shapes[0]!, theme);
    expect(shape.type === "rectangle" && shape.fill).toBe("#12abef");
    expect(shape.type === "rectangle" && rectangleAppearance(shape).stroke).toBe("#ab1298");
    expect(themedShape(document.shapes[1]!, theme)).toMatchObject({ color: "#4512ef" });
    expect(themedShape(document.shapes[2]!, theme)).toMatchObject({ color: "#78abce" });
    expect(themedConnector(document.connectors[0]!, theme).color).toBe("#fed987");
  }
  for (const color of ["red", "#abc", "#123456ff", "url(x)"]) {
    expect(() =>
      decodeDocument({ ...document, shapes: [{ ...source.shapes[0], fill: color }] }),
    ).toThrow();
    expect(() =>
      decodeDocument({ ...document, connectors: [{ ...document.connectors[0], color }] }),
    ).toThrow();
  }
});
