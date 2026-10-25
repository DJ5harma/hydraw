import { MAX_COORDINATE, MAX_SHAPES } from "./model.ts";
import type { BoardDocument, ImageShape, Point } from "./model.ts";
import { applyTransaction } from "./transactions.ts";
import type { DocumentTransaction } from "./transactions.ts";

export type ImageInput = Readonly<{ src: string; name: string; width: number; height: number }>;

/** All selected files enter together, with portable data and one undo step. */
export function insertImages(
  document: BoardDocument,
  images: readonly ImageInput[],
  point: Point,
  makeId: () => string,
): {
  transaction: DocumentTransaction | null;
  ids: readonly string[];
} {
  if (!images.length) return { transaction: null, ids: [] };
  if (images.length > 10 || document.shapes.length + images.length > MAX_SHAPES)
    throw new Error("There is not enough room to insert these images.");
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error("Invalid image position.");
  const used = new Set(
    [...document.shapes, ...document.connectors].flatMap((item) =>
      item.groupId ? [item.id, item.groupId] : [item.id],
    ),
  );
  const top = Math.max(
    0,
    ...[...document.shapes, ...document.connectors].map((item) => item.zIndex ?? 0),
  );
  const shapes: ImageShape[] = images.map((image, index) => {
    if (
      !Number.isFinite(image.width) ||
      !Number.isFinite(image.height) ||
      image.width <= 0 ||
      image.height <= 0
    )
      throw new Error("Invalid image dimensions.");
    const id = makeId();
    if (!id || id.length > 100 || used.has(id))
      throw new Error("Could not create unique image identities.");
    used.add(id);
    const scale = Math.min(1, 480 / Math.max(image.width, image.height));
    const width = Math.max(1, image.width * scale),
      height = Math.max(1, image.height * scale);
    const clamp = (value: number) => Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, value));
    return {
      id,
      type: "image",
      src: image.src,
      name: image.name,
      width,
      height,
      x: clamp(point.x - width / 2 + index * 24),
      y: clamp(point.y - height / 2 + index * 24),
      zIndex: Math.min(1_000_000_000, top + index + 1),
    };
  });
  const transaction: DocumentTransaction = {
    label: images.length === 1 ? "Insert image" : "Insert images",
    changes: shapes.map((shape) => ({
      type: "shape",
      before: null,
      after: shape,
    })),
  };
  applyTransaction(document, transaction);
  return { transaction, ids: shapes.map((shape) => shape.id) };
}
