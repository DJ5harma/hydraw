import { MAX_IMAGE_DATA_LENGTH } from "@hydraw/document";

const MAX_FILE_BYTES = 12_000_000;
const MAX_IMAGE_SIDE = 4_096;
const MAX_IMAGE_PIXELS = 40_000_000;

export type ImportedImage = Readonly<{ src: string; width: number; height: number; name: string }>;

/** Decode raster files locally and normalize them to portable PNGs. No remote URLs or SVG markup. */
export async function readBoardImage(file: File): Promise<ImportedImage> {
  if (!/^image\/(png|jpeg|webp)$/u.test(file.type))
    throw new Error("Choose a PNG, JPEG or WebP image.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Choose an image smaller than 12 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Choose a valid PNG, JPEG or WebP file.");
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS)
      throw new Error("This image is too large. Choose an image under 40 megapixels.");
    let scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    for (;;) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const src = canvas.toDataURL("image/png");
      if (src.length <= MAX_IMAGE_DATA_LENGTH)
        return {
          src,
          width: canvas.width,
          height: canvas.height,
          name: file.name.slice(0, 120) || "Pasted image",
        };
      if (Math.max(canvas.width, canvas.height) <= 128)
        throw new Error("This image is too large to store on the board.");
      scale *= 0.75;
    }
  } finally {
    bitmap.close();
  }
}
