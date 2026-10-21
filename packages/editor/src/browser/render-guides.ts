import type { Camera } from "../types.ts";
import type { SnapGuide } from "../snapping.ts";

/** Draw transient smart guides in screen space with a constant one-pixel stroke. */
export function renderGuides(
  ctx: CanvasRenderingContext2D,
  guides: readonly SnapGuide[],
  camera: Camera,
): void {
  if (!guides.length || !Number.isFinite(camera.zoom) || camera.zoom <= 0) return;
  ctx.save();
  ctx.strokeStyle = "#c13c84";
  ctx.fillStyle = "#c13c84";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (const guide of guides) {
    if (guide.kind === "spacing" && guide.gap !== undefined && guide.segments?.length) {
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (const segment of guide.segments) {
        const start = segment.start * camera.zoom + (guide.axis === "x" ? camera.x : camera.y);
        const end = segment.end * camera.zoom + (guide.axis === "x" ? camera.x : camera.y);
        const cross = segment.cross * camera.zoom + (guide.axis === "x" ? camera.y : camera.x);
        ctx.beginPath();
        if (guide.axis === "x") {
          ctx.moveTo(start, cross);
          ctx.lineTo(end, cross);
          ctx.moveTo(start, cross - 3);
          ctx.lineTo(start, cross + 3);
          ctx.moveTo(end, cross - 3);
          ctx.lineTo(end, cross + 3);
        } else {
          ctx.moveTo(cross, start);
          ctx.lineTo(cross, end);
          ctx.moveTo(cross - 3, start);
          ctx.lineTo(cross + 3, start);
          ctx.moveTo(cross - 3, end);
          ctx.lineTo(cross + 3, end);
        }
        ctx.stroke();
        const label = String(Math.round(guide.gap));
        if (guide.axis === "x") ctx.fillText(label, (start + end) / 2, cross - 3);
        else {
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(label, cross + 4, (start + end) / 2);
        }
      }
      continue;
    }
    const position = guide.position * camera.zoom + (guide.axis === "x" ? camera.x : camera.y);
    const start = guide.start * camera.zoom + (guide.axis === "x" ? camera.y : camera.x);
    const end = guide.end * camera.zoom + (guide.axis === "x" ? camera.y : camera.x);
    ctx.beginPath();
    if (guide.axis === "x") {
      ctx.moveTo(position, start);
      ctx.lineTo(position, end);
    } else {
      ctx.moveTo(start, position);
      ctx.lineTo(end, position);
    }
    ctx.stroke();
  }
  ctx.restore();
}
