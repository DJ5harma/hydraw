import { describe, expect, it } from "vite-plus/test";
import {
  applyTransaction,
  createDocument,
  decodeDocument,
  insertImages,
  MAX_BOARD_IMAGE_DATA_LENGTH,
  MAX_IMAGE_DATA_LENGTH,
  parseDocument,
  serializeDocument,
} from "./index.ts";
import type { ImageInput } from "./index.ts";

const prefix = "data:image/png;base64,iVBORw0KGgo";
const png = `${prefix}AAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/eXcAAAAASUVORK5CYII=`;
const image: ImageInput = { src: png, name: "one.png", width: 32, height: 24 };

describe("embedded image documents", () => {
  it("inserts images in one transaction and preserves embedded data through document round trips", () => {
    let id = 0;
    const initial = createDocument();
    const result = insertImages(
      initial,
      [image, { ...image, name: "two.png" }],
      { x: 200, y: 160 },
      () => `image-${++id}`,
    );
    expect(result.ids).toEqual(["image-1", "image-2"]);
    expect(result.transaction?.label).toBe("Insert images");
    expect(result.transaction?.changes).toHaveLength(2);
    const inserted = applyTransaction(initial, result.transaction!);
    expect(inserted.shapes).toMatchObject([
      {
        type: "image",
        id: "image-1",
        src: png,
        name: "one.png",
        x: 184,
        y: 148,
        width: 32,
        height: 24,
      },
      {
        type: "image",
        id: "image-2",
        src: png,
        name: "two.png",
        x: 208,
        y: 172,
        width: 32,
        height: 24,
      },
    ]);
    expect(parseDocument(serializeDocument(inserted))).toEqual(inserted);
    expect(insertImages(initial, [], { x: 0, y: 0 }, () => "unused")).toEqual({
      transaction: null,
      ids: [],
    });
  });

  it("rejects remote, SVG, malformed and oversized image sources", () => {
    const invalid = [
      "https://example.test/image.png",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "data:image/png;base64,not-a-png-signature",
      `${prefix}${"A".repeat(MAX_IMAGE_DATA_LENGTH - prefix.length + 1)}`,
    ];
    for (const src of invalid) {
      expect(() =>
        decodeDocument({
          ...createDocument(),
          shapes: [
            { id: "bad", type: "image", src, name: "bad", x: 0, y: 0, width: 10, height: 10 },
          ],
        }),
      ).toThrow();
      expect(() =>
        insertImages(createDocument(), [{ ...image, src }], { x: 0, y: 0 }, () => "bad"),
      ).toThrow();
    }
  });

  it("enforces the cumulative board image budget as an atomic transaction boundary", () => {
    const fullSource = `${prefix}${"A".repeat(MAX_IMAGE_DATA_LENGTH - prefix.length)}`;
    expect(fullSource.length).toBe(MAX_IMAGE_DATA_LENGTH);
    const batch = Array.from(
      { length: MAX_BOARD_IMAGE_DATA_LENGTH / MAX_IMAGE_DATA_LENGTH },
      (_, index) => ({
        ...image,
        src: fullSource,
        name: `large-${index}.png`,
      }),
    );
    let id = 0;
    const initial = createDocument();
    const inserted = insertImages(initial, batch, { x: 0, y: 0 }, () => `large-${++id}`);
    const atLimit = applyTransaction(initial, inserted.transaction!);
    expect(atLimit.shapes).toHaveLength(batch.length);
    expect(() => insertImages(atLimit, [image], { x: 0, y: 0 }, () => "over-limit")).toThrow(
      "24 MB",
    );
    expect(atLimit.shapes).toHaveLength(batch.length);
  });
});
