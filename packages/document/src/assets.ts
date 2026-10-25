import { MAX_SHAPES } from "./model.ts";
import type { BoardDocument, Shape, ImageShape } from "./model.ts";
import { decodeDocument } from "./validation.ts";

type AssetImage = Omit<ImageShape, "src"> & Readonly<{ assetId: string }>;
export type AssetDocument = Omit<BoardDocument, "shapes"> &
  Readonly<{
    assetFormat: 1;
    shapes: readonly (Exclude<Shape, ImageShape> | AssetImage)[];
  }>;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function manifest(value: unknown): Record<string, unknown> & { shapes: unknown[] } {
  if (!record(value) || value.format !== "hydraw" || value.version !== 1 || value.assetFormat !== 1)
    throw new Error("This board uses an unsupported Hydraw format or asset storage format.");
  if (!Array.isArray(value.shapes) || value.shapes.length > MAX_SHAPES)
    throw new Error("This board contains invalid stored shapes.");
  return value as Record<string, unknown> & { shapes: unknown[] };
}

/** Storage codec, separate from portable files. Identity is supplied by the asset adapter. */
export function packDocumentAssets(document: BoardDocument, identify: (source: string) => string) {
  const valid = decodeDocument(document);
  const assets = new Map<string, string>();
  const sources = new Map<string, string>();
  const shapes = valid.shapes.map((shape) => {
    if (shape.type !== "image") return shape;
    let assetId = sources.get(shape.src);
    if (!assetId) {
      assetId = identify(shape.src);
      if (!assetId || assetId.length > 128) throw new Error("Invalid asset identity.");
      const previous = assets.get(assetId);
      if (previous !== undefined && previous !== shape.src)
        throw new Error("Different images cannot share an asset identity.");
      assets.set(assetId, shape.src);
      sources.set(shape.src, assetId);
    }
    const { src: _source, ...image } = shape;
    return Object.freeze({ ...image, assetId });
  });
  const stored: AssetDocument = Object.freeze({
    ...valid,
    assetFormat: 1,
    shapes: Object.freeze(shapes),
  });
  return { document: stored, assets: assets as ReadonlyMap<string, string> };
}

export function documentAssetIds(value: unknown): readonly string[] {
  const stored = manifest(value);
  return Object.freeze([
    ...new Set(
      stored.shapes.flatMap((shape) => {
        if (!record(shape) || shape.type !== "image") return [];
        if (
          typeof shape.assetId !== "string" ||
          !shape.assetId ||
          shape.assetId.length > 128 ||
          "src" in shape
        )
          throw new Error("This board contains an invalid image asset reference.");
        return [shape.assetId];
      }),
    ),
  ]);
}

export function hydrateDocumentAssets(
  value: unknown,
  assets: ReadonlyMap<string, string>,
): BoardDocument {
  const stored = manifest(value);
  documentAssetIds(value);
  const shapes = stored.shapes.map((shape) => {
    if (!record(shape) || shape.type !== "image") return shape;
    const source = assets.get(shape.assetId as string);
    if (source === undefined)
      throw new Error("An image asset is missing. Existing board data has been preserved.");
    const { assetId: _assetId, ...image } = shape;
    return { ...image, src: source };
  });
  return decodeDocument({ ...stored, shapes });
}
