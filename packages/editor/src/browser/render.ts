import { rectangleAppearance, createConnectorResolver } from "@hydraw/document";
import type { Rectangle, Shape, TextShape, Connector } from "@hydraw/document";
import { drawConnector, drawConnectorHandles } from "./render-connectors.ts";
import { labelClipBounds, labelTextShape } from "../labels.ts";
import type { TextMeasurer } from "../text-layout.ts";
import { selectionScene } from "../selection.ts";
import { drawSelection } from "./render-selection.ts";
import {
  createTextLayouter,
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING,
} from "../text-layout.ts";
import type { Camera, EditorSnapshot } from "../types.ts";

import type { TextLayouter } from "../text-layout.ts";
import { createTextMeasurer } from "./text.ts";

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
  const style = rectangleAppearance(shape);
  ctx.save();
  ctx.globalAlpha = style.opacity / 100;
  ctx.beginPath();
  if (shape.kind === "ellipse")
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  else if (shape.kind === "diamond") {
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(x + width, y + height / 2);
    ctx.lineTo(x + width / 2, y + height);
    ctx.lineTo(x, y + height / 2);
    ctx.closePath();
  } else
    ctx.roundRect(
      x,
      y,
      width,
      height,
      Math.min(style.cornerRadius * camera.zoom, width / 2, height / 2),
    );
  if (shape.fill !== "transparent") {
    ctx.fillStyle = shape.fill;
    ctx.fill();
  }
  const lineWidth = style.strokeWidth * camera.zoom;
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = style.stroke;
  ctx.lineCap = style.strokeStyle === "dotted" ? "round" : "butt";
  ctx.setLineDash(
    style.strokeStyle === "dashed"
      ? [lineWidth * 5, lineWidth * 3]
      : style.strokeStyle === "dotted"
        ? [lineWidth, lineWidth * 3]
        : [],
  );
  ctx.stroke();
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  shape: TextShape,
  camera: Camera,
  textLayout: TextLayouter,
): void {
  ctx.save();
  ctx.translate(shape.x * camera.zoom + camera.x, shape.y * camera.zoom + camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.font = `${shape.fontWeight} ${shape.fontSize}px ${TEXT_FONT_FAMILY}`;
  ctx.fillStyle = shape.color;
  ctx.textBaseline = "top";
  ctx.textAlign = shape.textAlign;
  const layout = textLayout(shape);
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

function drawLabel(
  ctx: CanvasRenderingContext2D,
  owner: Rectangle | Connector,
  shapes: readonly Shape[],
  camera: Camera,
  textLayout: TextLayouter,
  measure: TextMeasurer,
): void {
  const label = labelTextShape(owner, shapes, measure);
  if (!label || !label.text) return;
  const clip = labelClipBounds(owner, shapes);
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    clip.x * camera.zoom + camera.x,
    clip.y * camera.zoom + camera.y,
    clip.width * camera.zoom,
    clip.height * camera.zoom,
  );
  ctx.clip();
  if (owner.type === "connector") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
      label.x * camera.zoom + camera.x,
      label.y * camera.zoom + camera.y,
      label.width * camera.zoom,
      Math.min(label.height, clip.height) * camera.zoom,
    );
  } else ctx.globalAlpha = rectangleAppearance(owner).opacity / 100;
  drawText(ctx, label, camera, textLayout);
  ctx.restore();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  camera: Camera,
  viewport: Viewport,
  textLayout: TextLayouter,
): void {
  if (shape.type === "rectangle") drawRectangle(ctx, shape, camera, viewport);
  else if (
    shape.x * camera.zoom + camera.x <= viewport.width &&
    shape.y * camera.zoom + camera.y <= viewport.height &&
    (shape.x + shape.width) * camera.zoom + camera.x >= 0 &&
    (shape.y + shape.height) * camera.zoom + camera.y >= 0
  )
    drawText(ctx, shape, camera, textLayout);
}

/** Draws a derived scene. It cannot subscribe, dispatch commands or mutate editor state. */
function renderScene(
  ctx: CanvasRenderingContext2D,
  snapshot: EditorSnapshot,
  viewport: Viewport,
  textLayout: TextLayouter,
  measure: TextMeasurer,
): void {
  const { width, height, dpr } = viewport;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { camera, selectedId } = snapshot;
  let spacing = 24 * camera.zoom;
  while (spacing < 14) spacing *= 2;
  ctx.fillStyle = "#d5d9df";
  for (let x = ((camera.x % spacing) + spacing) % spacing; x < width; x += spacing) {
    for (let y = ((camera.y % spacing) + spacing) % spacing; y < height; y += spacing)
      ctx.fillRect(x, y, 1.2, 1.2);
  }
  const { shapes: sceneShapes, connectors: sceneConnectors } = selectionScene(snapshot);
  const resolveConnector = createConnectorResolver(sceneShapes);
  const selectedIds = new Set(snapshot.selectedIds);
  for (const connector of sceneConnectors) {
    drawConnector(
      ctx,
      connector,
      resolveConnector,
      camera,
      selectedIds.has(connector.id) || connector.id === snapshot.connectorPreview?.id,
    );
    if (snapshot.textEditing?.ownerId !== connector.id)
      drawLabel(ctx, connector, sceneShapes, camera, textLayout, measure);
  }
  for (const shape of sceneShapes) {
    if (snapshot.textEditing?.ownerId || snapshot.textEditing?.draft.id !== shape.id)
      drawShape(ctx, shape, camera, viewport, textLayout);
    if (shape.type === "rectangle" && snapshot.textEditing?.ownerId !== shape.id)
      drawLabel(ctx, shape, sceneShapes, camera, textLayout, measure);
  }
  const selectedConnector =
    snapshot.connectorPreview ?? sceneConnectors.find((connector) => connector.id === selectedId);
  if (selectedConnector && (snapshot.tool === "select" || snapshot.connectorPreview))
    drawConnectorHandles(ctx, selectedConnector, resolveConnector, camera);
  const bindingTarget = sceneShapes.find((shape) => shape.id === snapshot.bindingTargetId);
  if (bindingTarget) {
    ctx.strokeStyle = "#67944a";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(
      bindingTarget.x * camera.zoom + camera.x - 4,
      bindingTarget.y * camera.zoom + camera.y - 4,
      bindingTarget.width * camera.zoom + 8,
      bindingTarget.height * camera.zoom + 8,
    );
    ctx.setLineDash([]);
  }
  drawSelection(ctx, snapshot, sceneShapes, sceneConnectors);
}

/** Per-canvas caches share the renderer's font metrics and live only as long as the adapter. */
export function createSceneRenderer(ctx: CanvasRenderingContext2D) {
  const measure = createTextMeasurer(ctx);
  const textLayout = createTextLayouter(measure);
  return (snapshot: EditorSnapshot, viewport: Viewport): void =>
    renderScene(ctx, snapshot, viewport, textLayout, measure);
}
