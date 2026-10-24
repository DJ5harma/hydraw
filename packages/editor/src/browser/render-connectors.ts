import type { Connector, ConnectorResolver } from "@hydraw/document";
import type { Camera } from "../types.ts";

export function drawConnector(
  ctx: CanvasRenderingContext2D,
  connector: Connector,
  resolve: ConnectorResolver,
  camera: Camera,
  selected: boolean,
): void {
  const ends = resolve(connector);
  const points = ends.points.map((point) => ({
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y,
  }));
  const start = points[0]!,
    end = points.at(-1)!,
    beforeEnd = points.at(-2)!;
  const length = Math.hypot(end.x - beforeEnd.x, end.y - beforeEnd.y);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = selected ? "#3568db" : connector.color;
  ctx.lineWidth = selected ? 2.5 : 2;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  if (connector.arrowhead === "arrow" && length > 0) {
    const angle = Math.atan2(end.y - beforeEnd.y, end.x - beforeEnd.x);
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
  resolve: ConnectorResolver,
  camera: Camera,
): void {
  const ends = resolve(connector);
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
  if (ends.bend) {
    const x = ends.bend.point.x * camera.zoom + camera.x;
    const y = ends.bend.point.y * camera.zoom + camera.y;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.strokeRect(x - 4, y - 4, 8, 8);
  }
  ctx.restore();
}
