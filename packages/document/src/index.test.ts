import { describe, expect, it } from "vite-plus/test";
import {
  createDocument,
  decodeDocument,
  hitTest,
  parseDocument,
  rectangleBetween,
} from "./index.ts";

describe("version 0 documents", () => {
  const shape = rectangleBetween("a", { x: 90, y: 80 }, { x: 10, y: 20 }, "#e7eefb");
  it("normalizes reverse drawing and round-trips known semantic data", () => {
    const document = { ...createDocument(), shapes: [shape] };
    expect(shape).toMatchObject({ x: 10, y: 20, width: 80, height: 60 });
    expect(parseDocument(JSON.stringify(document))).toEqual(document);
    expect(decodeDocument({ ...document, rendererCache: "ignored" })).not.toHaveProperty(
      "rendererCache",
    );
  });
  it("rejects future versions, malformed geometry, duplicate IDs and unbounded files", () => {
    expect(() => decodeDocument({ ...createDocument(), version: 1 })).toThrow("unsupported");
    for (const invalid of [NaN, Infinity, -1, 0, 100_001]) {
      expect(() =>
        decodeDocument({ ...createDocument(), shapes: [{ ...shape, width: invalid }] }),
      ).toThrow("invalid");
    }
    expect(() => decodeDocument({ ...createDocument(), shapes: [shape, shape] })).toThrow(
      "invalid",
    );
    expect(() => parseDocument(" ".repeat(2_000_001))).toThrow("too large");
  });
  it("hits the topmost shape and includes its border", () => {
    const front = { ...shape, id: "front" };
    expect(hitTest([shape, front], { x: 10, y: 20 })?.id).toBe("front");
    expect(hitTest([shape], { x: 9, y: 20 })).toBeUndefined();
  });
});
