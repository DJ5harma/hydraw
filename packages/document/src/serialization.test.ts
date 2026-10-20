import { expect, it } from "vite-plus/test";
import {
  createDocument,
  decodeDocument,
  MAX_CONNECTORS,
  MAX_DOCUMENT_BYTES,
  MAX_SHAPES,
  MAX_TEXT_LENGTH,
  parseDocument,
  serializeDocument,
} from "./index.ts";

it("reopens valid text-heavy exports larger than the former 2 MB limit", () => {
  const document = decodeDocument({
    ...createDocument(),
    shapes: Array.from({ length: 1_000 }, (_, index) => ({
      id: `text-${index}`,
      type: "text",
      x: 0,
      y: 0,
      width: 300,
      height: 2400,
      text: "a".repeat(MAX_TEXT_LENGTH),
      fontSize: 16,
      fontWeight: 400,
      textAlign: "left",
      color: "#202124",
    })),
  });
  const encoded = serializeDocument(document);
  expect(encoded.length).toBeGreaterThan(2_000_000);
  expect(parseDocument(encoded)).toEqual(document);
});

it("budgets enough bytes for maximum record counts and worst-case JSON escaping", () => {
  // An unpaired surrogate takes six ASCII bytes in JSON, more than any valid UTF-8 unit.
  const id = "\ud800".repeat(100);
  const document = decodeDocument({
    ...createDocument(),
    name: "\ud800".repeat(120),
    shapes: [
      {
        id,
        type: "text",
        x: -999999.9999999999,
        y: -999999.9999999999,
        width: 99999.99999999999,
        height: 999999.9999999999,
        text: "\ud800".repeat(MAX_TEXT_LENGTH),
        fontSize: 95.99999999999999,
        fontWeight: 700,
        textAlign: "center",
        color: "#202124",
      },
      { id: "b", type: "rectangle", x: 0, y: 0, width: 1, height: 1, fill: "#ffffff" },
    ],
    connectors: [
      {
        id: "\ud801".repeat(100),
        type: "connector",
        start: { type: "binding", shapeId: id },
        end: { type: "binding", shapeId: "b" },
        color: "#202124",
        arrowhead: "arrow",
      },
    ],
  });
  const shapeBytes = JSON.stringify(document.shapes[0]).length + 1;
  // Both bound IDs may use all 100 escaped UTF-16 units.
  const connectorBytes = JSON.stringify(document.connectors[0]).length + 1 + (100 * 6 - 1);
  const metadataBytes = serializeDocument({ ...document, shapes: [], connectors: [] }).length;
  expect(metadataBytes + MAX_SHAPES * shapeBytes + MAX_CONNECTORS * connectorBytes).toBeLessThan(
    MAX_DOCUMENT_BYTES,
  );
});
