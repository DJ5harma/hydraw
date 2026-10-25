import { expect, it } from "vite-plus/test";
import {
  applyTransaction,
  createDocument,
  decodeDocument,
  imageBoundsForCrop,
  imageCropTransaction,
  planTransaction,
  reflectedImageCrop,
  shapeTransaction,
  sourceImageBounds,
} from "./index.ts";
import type { ImageShape } from "./index.ts";
const image: ImageShape = {
  id: "image",
  type: "image",
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  name: "Image",
  src: "data:image/png;base64,iVBORw0KGgoAAA",
  flipX: true,
  flipY: true,
  crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
};
it("keeps source-relative crops and mirrored display geometry consistent through reset and undo", () => {
  expect(sourceImageBounds(image)).toEqual({ x: -60, y: 40, width: 400, height: 200 });
  expect(imageBoundsForCrop(image, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 })).toEqual({
    x: 40,
    y: 90,
    width: 200,
    height: 100,
  });
  const before = decodeDocument({ ...createDocument(), shapes: [image] });
  const change = imageCropTransaction(before, image.id, null)!;
  const reset = applyTransaction(before, change);
  expect(reset.shapes[0]).toMatchObject({
    x: -60,
    y: 40,
    width: 400,
    height: 200,
    flipX: true,
    flipY: true,
  });
  expect(reset.shapes[0]).not.toHaveProperty("crop");
  expect(applyTransaction(reset, planTransaction(before, change).inverse)).toEqual(before);
  expect(
    reflectedImageCrop({ flipX: true }, { x: 0.8, y: 0, width: 0.2, height: 1 }).x,
  ).toBeGreaterThanOrEqual(0);
});
it("validates reflection fields and detects stale orientation-only edits", () => {
  const before = decodeDocument({ ...createDocument(), shapes: [image] });
  const change = shapeTransaction("Reflect image", image, { ...image, flipX: false })!;
  const next = applyTransaction(before, change);
  expect(next.shapes[0]).not.toHaveProperty("flipX");
  expect(() => applyTransaction(next, change)).toThrow();
  expect(applyTransaction(next, planTransaction(before, change).inverse)).toEqual(before);
  for (const flipX of [1, "true", null])
    expect(() => decodeDocument({ ...before, shapes: [{ ...image, flipX }] })).toThrow(
      "invalid image",
    );
});
