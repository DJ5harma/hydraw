import { resolveConnector } from "@hydraw/document";
import type { Connector, Shape } from "@hydraw/document";
import type { Camera } from "../types.ts";

export function drawConnector(
  ctx: CanvasRenderingContext2D,
  connector: Connector,
  shapes: readonly Shape[],
  camera: Camera,
  selected: boolean,
): void {
  const ends = resolveConnector(connector, shapes);
  const start = {
    x: ends.start.x * camera.zoom + camera.x,
    y: ends.start.y * camera.zoom + camera.y,
  };
  const end = { x: ends.end.x * camera.zoom + camera.x, y: ends.end.y * camera.zoom + camera.y };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = selected ? "#3568db" : connector.color;
  ctx.lineWidth = selected ? 2.5 : 2;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  if (connector.arrowhead === "arrow" && length > 0) {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const size = Math.min(11, length / 2);
    ctx.beginPath();
    ctx.moveTo(
      end.x - Math.cos(angle - Math.PI / 6) * size,
      end.y - Math.sin(angle - Math.PI / 6) * size,
    );
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(
      end.x - Math.cos(angle + Math.PI / 6) * size,
      end.y - Math.sin(angle + Math.PI / 6) * size,
    );
    ctx.stroke();
  }
  ctx.restore();
}

export function drawConnectorHandles(
  ctx: CanvasRenderingContext2D,
  connector: Connector,
  shapes: readonly Shape[],
  camera: Camera,
): void {
  const ends = resolveConnector(connector, shapes);
  ctx.save();
  ctx.strokeStyle = "#3568db";
  ctx.lineWidth = 1.5;
  for (const key of ["start", "end"] as const) {
    const point = ends[key];
    ctx.beginPath();
    ctx.arc(point.x * camera.zoom + camera.x, point.y * camera.zoom + camera.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = connector[key].type === "binding" ? "#dcebd4" : "#ffffff";
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
