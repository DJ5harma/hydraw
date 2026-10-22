import type { ImageShape } from "@hydraw/document";
import type { Camera } from "../types.ts";

/** Decoded resources live with a canvas, never in the semantic document. */
export function createImagePainter(schedule: () => void) {
  const cache = new Map<string, HTMLImageElement>();
  let disposed = false;
  function draw(ctx: CanvasRenderingContext2D, shape: ImageShape, camera: Camera) {
    const x = shape.x * camera.zoom + camera.x,
      y = shape.y * camera.zoom + camera.y;
    const width = shape.width * camera.zoom,
      height = shape.height * camera.zoom;
    if (
      x + width < 0 ||
      y + height < 0 ||
      x > ctx.canvas.clientWidth ||
      y > ctx.canvas.clientHeight
    )
      return;
    let image = cache.get(shape.src);
    if (!image) {
      image = new Image();
      image.onload = image.onerror = () => {
        if (!disposed) schedule();
      };
      image.src = shape.src;
      cache.set(shape.src, image);
    }
    if (image.complete && image.naturalWidth) ctx.drawImage(image, x, y, width, height);
    else {
      ctx.fillStyle = "#edf0f4";
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = "#8b96a5";
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = "#364152";
      ctx.font = "12px Arial, sans-serif";
      ctx.fillText(
        image.complete ? "Image unavailable" : "Loading image…",
        x + 8,
        y + 20,
        Math.max(1, width - 16),
      );
    }
  }
  return {
    draw,
    retain(sources: ReadonlySet<string>) {
      for (const [src, image] of cache)
        if (!sources.has(src)) {
          image.onload = image.onerror = null;
          cache.delete(src);
        }
    },
    dispose() {
      disposed = true;
      for (const image of cache.values()) image.onload = image.onerror = null;
      cache.clear();
    },
  };
}
export type ImagePainter = ReturnType<typeof createImagePainter>;
