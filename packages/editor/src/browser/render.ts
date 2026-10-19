import type { Rectangle, Shape, TextShape } from "@hydraw/document";
import { handlePoint, resizeHandles } from "../geometry.ts";
import { layoutText, TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT, TEXT_PADDING } from "../text-layout.ts";
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

function drawText(ctx: CanvasRenderingContext2D, shape: TextShape, camera: Camera): void {
  ctx.save();
  ctx.translate(shape.x * camera.zoom + camera.x, shape.y * camera.zoom + camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.font = `${shape.fontWeight} ${shape.fontSize}px ${TEXT_FONT_FAMILY}`;
  ctx.fillStyle = shape.color;
  ctx.textBaseline = "top";
  ctx.textAlign = shape.textAlign;
  const layout = layoutText(shape, (text) => ctx.measureText(text).width);
  const x =
    shape.textAlign === "left"
      ? TEXT_PADDING
      : shape.textAlign === "center"
        ? shape.width / 2
        : shape.width - TEXT_PADDING;
  layout.lines.forEach((line, index) => {
    ctx.fillText(
      line,
      x,
      TEXT_PADDING + index * shape.fontSize * TEXT_LINE_HEIGHT + shape.fontSize * 0.15,
    );
  });
  ctx.restore();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  camera: Camera,
  viewport: Viewport,
): void {
  if (shape.type === "rectangle") drawRectangle(ctx, shape, camera, viewport);
  else if (
    shape.x * camera.zoom + camera.x <= viewport.width &&
    shape.y * camera.zoom + camera.y <= viewport.height &&
    (shape.x + shape.width) * camera.zoom + camera.x >= 0 &&
    (shape.y + shape.height) * camera.zoom + camera.y >= 0
  )
    drawText(ctx, shape, camera);
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
    if (preview?.id !== shape.id && snapshot.textEditing?.draft.id !== shape.id)
      drawShape(ctx, shape, camera, viewport);
  }
  if (preview) drawShape(ctx, preview, camera, viewport);
  const selected =
    snapshot.textEditing?.draft ??
    preview ??
    document.shapes.find((shape) => shape.id === selectedId);
  if (!selected) return;
  ctx.strokeStyle = "#3568db";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    selected.x * camera.zoom + camera.x,
    selected.y * camera.zoom + camera.y,
    selected.width * camera.zoom,
    selected.height * camera.zoom,
  );
  if (snapshot.tool !== "select" || snapshot.textEditing) return;
  for (const handle of resizeHandles(selected)) {
    const point = handlePoint(selected, handle);
    const x = point.x * camera.zoom + camera.x;
    const y = point.y * camera.zoom + camera.y;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeRect(x - 3, y - 3, 6, 6);
  }
}
