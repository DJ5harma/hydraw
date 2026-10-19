import type { Rectangle } from "@hydraw/document";
import { handlePoint, RESIZE_HANDLES } from "../geometry.ts";
import type { Camera, EditorSnapshot } from "../types.ts";

type Viewport = Readonly<{ width: number; height: number; dpr: number }>;

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  shape: Rectangle,
  camera: Camera,
  viewport: Viewport,
): void {
  const x = shape.x * camera.zoom + camera.x;
  const y = shape.y * camera.zoom + camera.y;
  const width = shape.width * camera.zoom;
  const height = shape.height * camera.zoom;
  if (x + width < -10 || y + height < -10 || x > viewport.width + 10 || y > viewport.height + 10)
    return;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.min(8 * camera.zoom, width / 2, height / 2));
  ctx.fillStyle = shape.fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#364152";
  ctx.stroke();
}

/** Draws a derived scene. It cannot subscribe, dispatch commands or mutate editor state. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  snapshot: EditorSnapshot,
  viewport: Viewport,
): void {
  const { width, height, dpr } = viewport;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { camera, preview, document, selectedId } = snapshot;
  let spacing = 24 * camera.zoom;
  while (spacing < 14) spacing *= 2;
  ctx.fillStyle = "#d5d9df";
  for (let x = ((camera.x % spacing) + spacing) % spacing; x < width; x += spacing) {
    for (let y = ((camera.y % spacing) + spacing) % spacing; y < height; y += spacing)
      ctx.fillRect(x, y, 1.2, 1.2);
  }
  for (const shape of document.shapes) {
    if (preview?.id !== shape.id) drawRectangle(ctx, shape, camera, viewport);
  }
  if (preview) drawRectangle(ctx, preview, camera, viewport);
  const selected = preview ?? document.shapes.find((shape) => shape.id === selectedId);
  if (!selected) return;
  ctx.strokeStyle = "#3568db";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    selected.x * camera.zoom + camera.x,
    selected.y * camera.zoom + camera.y,
    selected.width * camera.zoom,
    selected.height * camera.zoom,
  );
  if (snapshot.tool !== "select") return;
  for (const handle of RESIZE_HANDLES) {
    const point = handlePoint(selected, handle);
    const x = point.x * camera.zoom + camera.x;
    const y = point.y * camera.zoom + camera.y;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeRect(x - 3, y - 3, 6, 6);
  }
}
