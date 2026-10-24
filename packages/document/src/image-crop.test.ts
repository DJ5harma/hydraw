import { describe, expect, it } from "vite-plus/test";
import type { ImageShape } from "./model.ts";
import {
  applyTransaction,
  createDocument,
  decodeDocument,
  imageCropTransaction,
  invertTransaction,
  parseDocument,
  shapeTransaction,
  serializeDocument,
  sourceImageBounds,
} from "./index.ts";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const original = {
  id: "photo",
  type: "image" as const,
  src: png,
  name: "photo.png",
  x: 100,
  y: 50,
  width: 200,
  height: 100,
};

describe("non-destructive image cropping", () => {
  it("maps normalized source coordinates to visible bounds and can be adjusted repeatedly", () => {
    const doc = decodeDocument({ ...createDocument(), shapes: [original] });
    const first = imageCropTransaction(doc, "photo", { x: 0.25, y: 0.1, width: 0.5, height: 0.8 })!;
    const cropped = applyTransaction(doc, first);
    expect(cropped.shapes[0]).toMatchObject({
      id: "photo",
      type: "image",
      src: png,
      name: "photo.png",
      x: 150,
      y: 60,
      width: 100,
      height: 80,
      crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.8 },
    });
    const adjusted = applyTransaction(
      cropped,
      imageCropTransaction(cropped, "photo", { x: 0.5, y: 0.2, width: 0.25, height: 0.4 })!,
    );
    expect(adjusted.shapes[0]).toMatchObject({ x: 200, y: 70, width: 50, height: 40 });
    expect(sourceImageBounds(adjusted.shapes[0] as typeof original)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 100,
    });
    expect(parseDocument(serializeDocument(adjusted))).toEqual(adjusted);
  });

  it("resets to the full source bounds and undo restores the crop", () => {
    const doc = decodeDocument({ ...createDocument(), shapes: [original] });
    const crop = imageCropTransaction(doc, "photo", { x: 0.2, y: 0.25, width: 0.6, height: 0.5 })!;
    const cropped = applyTransaction(doc, crop);
    const reset = imageCropTransaction(cropped, "photo", null)!;
    const resetDocument = applyTransaction(cropped, reset);
    expect(resetDocument.shapes[0]).toEqual(original);
    expect(applyTransaction(resetDocument, invertTransaction(reset))).toEqual(cropped);
  });

  it("keeps the full source geometry coherent through move and resize before reset", () => {
    const doc = decodeDocument({ ...createDocument(), shapes: [original] });
    const cropped = applyTransaction(
      doc,
      imageCropTransaction(doc, "photo", { x: 0.25, y: 0.2, width: 0.5, height: 0.6 })!,
    );
    const image = cropped.shapes[0]!;
    const moved = applyTransaction(
      cropped,
      shapeTransaction("Move", 0, image, { ...image, x: image.x + 10, y: image.y - 5 })!,
    );
    expect(sourceImageBounds(moved.shapes[0] as typeof original)).toEqual({
      x: 110,
      y: 45,
      width: 200,
      height: 100,
    });
    const resizedImage = moved.shapes[0]!;
    const resized = applyTransaction(
      moved,
      shapeTransaction("Resize", 0, resizedImage, {
        ...resizedImage,
        width: resizedImage.width * 2,
        height: resizedImage.height * 2,
      })!,
    );
    const resizedSource = sourceImageBounds(resized.shapes[0] as typeof original);
    expect(resizedSource.x).toBeCloseTo(60);
    expect(resizedSource.y).toBeCloseTo(25);
    expect(resizedSource.width).toBe(400);
    expect(resizedSource.height).toBe(200);
    const reset = applyTransaction(resized, imageCropTransaction(resized, "photo", null)!);
    const resetImage = reset.shapes[0] as ImageShape;
    expect(resetImage.x).toBeCloseTo(60);
    expect(resetImage.y).toBeCloseTo(25);
    expect(resetImage.width).toBe(400);
    expect(resetImage.height).toBe(200);
    expect(resetImage.crop).toBeUndefined();
  });

  it("rejects invalid normalized crops and crop metadata in legacy versions", () => {
    const doc = decodeDocument({ ...createDocument(), shapes: [original] });
    for (const crop of [
      { x: -0.1, y: 0, width: 0.5, height: 1 },
      { x: 0.8, y: 0, width: 0.3, height: 1 },
      { x: 0, y: 0, width: 0, height: 1 },
      { x: 0, y: Number.NaN, width: 1, height: 1 },
    ])
      expect(() => imageCropTransaction(doc, "photo", crop)).toThrow();
    const crop = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
    expect(() =>
      decodeDocument({ ...createDocument(), version: 9, shapes: [{ ...original, crop }] }),
    ).toThrow("version 10");
    expect(
      decodeDocument({ ...createDocument(), shapes: [{ ...original, crop }] }).shapes[0],
    ).toMatchObject({ crop });
  });
});
