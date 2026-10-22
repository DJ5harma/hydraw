import type { Bounds, Connector, Shape } from "@hydraw/document";
import { handlePoint, resizeHandles } from "../geometry.ts";
import { selectionBounds } from "../selection.ts";
import { connectionHandlePoint } from "../connector-interactions.ts";
import type { Camera, EditorSnapshot } from "../types.ts";

function box(ctx: CanvasRenderingContext2D, bounds: Bounds, camera: Camera): void {
  ctx.strokeRect(
    bounds.x * camera.zoom + camera.x,
    bounds.y * camera.zoom + camera.y,
    bounds.width * camera.zoom,
    bounds.height * camera.zoom,
  );
}

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  snapshot: EditorSnapshot,
  shapes: readonly Shape[],
  connectors: readonly Connector[],
): void {
  const { camera, selectedIds } = snapshot;
  const selected =
    (snapshot.textEditing?.ownerId ? null : snapshot.textEditing?.draft) ??
    snapshot.preview ??
    shapes.find((shape) => shape.id === snapshot.selectedId);
  ctx.save();
  ctx.strokeStyle = "#3568db";
  ctx.lineWidth = 1;
  if (selectedIds.length > 1) {
    const ids = new Set(selectedIds);
    for (const shape of shapes) if (ids.has(shape.id)) box(ctx, shape, camera);
    const bounds = selectionBounds(shapes, connectors, selectedIds);
    if (bounds) {
      ctx.setLineDash([5, 4]);
      box(ctx, bounds, camera);
      ctx.setLineDash([]);
    }
  } else if (selected) {
    box(ctx, selected, camera);
    if (snapshot.tool === "select" && !snapshot.textEditing && !selected.locked)
      for (const handle of resizeHandles(selected)) {
        const point = handlePoint(selected, handle);
        const x = point.x * camera.zoom + camera.x;
        const y = point.y * camera.zoom + camera.y;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.strokeRect(x - 3, y - 3, 6, 6);
      }
    if (
      snapshot.tool === "select" &&
      !snapshot.textEditing &&
      !selected.locked &&
      selected.type === "rectangle" &&
      selected.kind !== "frame"
    ) {
      for (const handle of ["north", "east", "south", "west"] as const) {
        const point = connectionHandlePoint(selected, handle);
        const x = point.x * camera.zoom + camera.x;
        const y = point.y * camera.zoom + camera.y;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#3568db";
        ctx.stroke();
      }
    }
  }
  if (snapshot.marquee) {
    const bounds = snapshot.marquee;
    ctx.fillStyle = "#3568db14";
    ctx.fillRect(
      bounds.x * camera.zoom + camera.x,
      bounds.y * camera.zoom + camera.y,
      bounds.width * camera.zoom,
      bounds.height * camera.zoom,
    );
    box(ctx, bounds, camera);
  }
  ctx.restore();
}
