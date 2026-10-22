import type { InkShape } from "@hydraw/document";
import type { Camera } from "../types.ts";

export function drawInk(ctx: CanvasRenderingContext2D, shape: InkShape, camera: Camera): void {
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth * camera.zoom;
  ctx.lineCap = ctx.lineJoin = "round";
  const point = (index: number) => ({
    x: (shape.x + shape.points[index]!.x * shape.width) * camera.zoom + camera.x,
    y: (shape.y + shape.points[index]!.y * shape.height) * camera.zoom + camera.y,
  });
  const first = point(0);
  ctx.beginPath();
  if (shape.points.length === 1) {
    ctx.arc(first.x, first.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < shape.points.length; i++) {
      const p = point(i);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
