import { MAX_COORDINATE, MAX_SIZE } from "./model.ts";
import type { Bounds, ImageCrop, ImageShape } from "./model.ts";

export const FULL_IMAGE_CROP: ImageCrop = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });

/** Validate normalized source-image coordinates and return only the portable crop fields. */
export function normalizeImageCrop(value: unknown): ImageCrop {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Image crop must be a normalized rectangle.");
  const crop = value as Record<string, unknown>;
  const { x, y, width, height } = crop;
  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    typeof height !== "number" ||
    !Number.isFinite(height) ||
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > 1 ||
    y + height > 1
  )
    throw new Error("Image crop must stay within the source image.");
  return Object.freeze({ x, y, width, height });
}

/** Convert between source-pixel and displayed crop coordinates; reflection is its own inverse. */
export function reflectedImageCrop(
  image: Pick<ImageShape, "flipX" | "flipY">,
  crop: ImageCrop,
): ImageCrop {
  return {
    ...crop,
    x: image.flipX
      ? Math.max(0, Math.min(1 - crop.width, Number((1 - crop.x - crop.width).toPrecision(15))))
      : crop.x,
    y: image.flipY
      ? Math.max(0, Math.min(1 - crop.height, Number((1 - crop.y - crop.height).toPrecision(15))))
      : crop.y,
  };
}

/** Recover the original image rectangle from the currently visible bounds and crop. */
export function sourceImageBounds(image: ImageShape): Bounds {
  const crop = reflectedImageCrop(image, image.crop ?? FULL_IMAGE_CROP);
  return {
    x: image.x - (crop.x / crop.width) * image.width,
    y: image.y - (crop.y / crop.height) * image.height,
    width: image.width / crop.width,
    height: image.height / crop.height,
  };
}

/** Calculate visible board bounds for a source-normalized crop. */
export function imageBoundsForCrop(image: ImageShape, value: unknown): Bounds {
  const crop = reflectedImageCrop(image, normalizeImageCrop(value));
  const source = sourceImageBounds(image);
  return {
    x: source.x + crop.x * source.width,
    y: source.y + crop.y * source.height,
    width: crop.width * source.width,
    height: crop.height * source.height,
  };
}

/** Ensure imported crop metadata still implies a legal full-source image rectangle. */
export function assertValidSourceImageBounds(image: ImageShape): void {
  const source = sourceImageBounds(image);
  if (
    !Number.isFinite(source.x) ||
    source.x < -MAX_COORDINATE ||
    source.x > MAX_COORDINATE ||
    !Number.isFinite(source.y) ||
    source.y < -MAX_COORDINATE ||
    source.y > MAX_COORDINATE ||
    !Number.isFinite(source.width) ||
    source.width < 1 ||
    source.width > MAX_SIZE ||
    !Number.isFinite(source.height) ||
    source.height < 1 ||
    source.height > MAX_SIZE
  )
    throw new Error("This board contains invalid cropped image geometry.");
}
