import { describe, expect, it } from "vite-plus/test";
import {
  applyTransaction,
  createDocument,
  decodeDocument,
  invertTransaction,
  parseDocument,
  shapeTransaction,
} from "./index.ts";
import type { TextShape } from "./index.ts";

const text: TextShape = {
  id: "a",
  type: "text",
  text: "Hello\n世界",
  x: 10,
  y: 20,
  width: 240,
  height: 76,
  fontSize: 24,
  fontWeight: 400,
  textAlign: "left",
  color: "#243e33",
};
describe("version 1 text documents", () => {
  it("migrates rectangle-only v0 without losing records, and round-trips v1 text", () => {
    const legacy = {
      format: "hydraw",
      version: 0,
      name: "Legacy",
      shapes: [{ id: "r", type: "rectangle", x: 1, y: 2, width: 30, height: 40, fill: "#e7eefb" }],
    };
    expect(decodeDocument(legacy)).toEqual({ ...legacy, version: 2, connectors: [] });
    expect(legacy.version).toBe(0);
    expect(
      decodeDocument({ format: "hydraw", version: 1, name: "Text from v1", shapes: [text] }),
    ).toEqual({ ...createDocument(), name: "Text from v1", shapes: [text] });
    const document = { ...createDocument(), shapes: [text] };
    expect(parseDocument(JSON.stringify(document))).toEqual(document);
    expect(() => decodeDocument({ ...document, version: 0 })).toThrow("invalid");
  });
  it("rejects invalid text content, styling, geometry and cross-type duplicate identities", () => {
    for (const patch of [
      { text: "a".repeat(2001) },
      { text: "bad\u0000" },
      { fontSize: 0 },
      { fontSize: 97 },
      { fontWeight: 500 },
      { textAlign: "justify" },
      { color: "url(x)" },
      { height: Infinity },
    ]) {
      expect(() =>
        decodeDocument({ ...createDocument(), shapes: [{ ...text, ...patch }] }),
      ).toThrow("invalid text");
    }
    expect(() =>
      decodeDocument({
        ...createDocument(),
        shapes: [
          text,
          { id: "a", type: "rectangle", x: 0, y: 0, width: 1, height: 1, fill: "#e7eefb" },
        ],
      }),
    ).toThrow("duplicate");
  });
  it("compares all semantic text fields in history and rejects stale edits and type changes", () => {
    const document = decodeDocument({ ...createDocument(), shapes: [text] });
    for (const patch of [
      { text: "Changed" },
      { fontSize: 32 },
      { fontWeight: 700 as const },
      { textAlign: "right" as const },
      { color: "#3568db" as const },
    ]) {
      const transaction = shapeTransaction("Edit text", 0, text, { ...text, ...patch })!;
      const next = applyTransaction(document, transaction);
      expect(applyTransaction(next, invertTransaction(transaction))).toEqual(document);
      expect(() => applyTransaction(next, transaction)).toThrow("changed");
    }
    expect(() =>
      applyTransaction(
        document,
        shapeTransaction("Change type", 0, text, {
          id: "a",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          fill: "#e7eefb",
        })!,
      ),
    ).toThrow("identity");
  });
});
