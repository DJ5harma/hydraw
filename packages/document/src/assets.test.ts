import { describe, expect, it } from "vite-plus/test";
import {
  createDocument,
  packDocumentAssets,
  hydrateDocumentAssets,
  documentAssetIds,
} from "./index.ts";

const source =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const image = {
  id: "a",
  type: "image" as const,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  src: source,
  name: "Diagram",
  crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
  flipX: true,
};

describe("document asset boundary", () => {
  it("deduplicates immutable pixels and round-trips crop, reflection and portable data", () => {
    const board = { ...createDocument(), shapes: [image, { ...image, id: "b", x: 200 }] };
    const packed = packDocumentAssets(board, () => "pixels");
    expect(packed.assets.size).toBe(1);
    expect(JSON.stringify(packed.document)).not.toContain("base64");
    expect(documentAssetIds(packed.document)).toEqual(["pixels"]);
    expect(hydrateDocumentAssets(packed.document, packed.assets)).toEqual(board);
    expect(board.shapes[0]?.src).toBe(source);
  });

  it("rejects missing or invalid asset bytes without modifying stored data", () => {
    const packed = packDocumentAssets({ ...createDocument(), shapes: [image] }, () => "pixels");
    const before = JSON.stringify(packed.document);
    expect(() => hydrateDocumentAssets(packed.document, new Map())).toThrow("missing");
    expect(() =>
      hydrateDocumentAssets(
        packed.document,
        new Map([["pixels", "https://example.invalid/image"]]),
      ),
    ).toThrow();
    expect(JSON.stringify(packed.document)).toBe(before);
  });

  it("rejects storage versions, invalid references and identity collisions", () => {
    expect(() => documentAssetIds({ ...createDocument(), assetFormat: 99 })).toThrow("unsupported");
    expect(() =>
      documentAssetIds({ ...createDocument(), assetFormat: 1, shapes: [image] }),
    ).toThrow("reference");
    const other = { ...image, id: "b", src: source.replace("AAAADUl", "AAAAEUl") };
    expect(() =>
      packDocumentAssets({ ...createDocument(), shapes: [image, other] }, () => "same"),
    ).toThrow("identity");
  });
});
