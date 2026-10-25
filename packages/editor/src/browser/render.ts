import { drawInk } from "./render-ink.ts";
import {
  rectangleAppearance,
  createConnectorResolver,
  sceneObjects,
  themePalette,
  themedShape,
  themedConnector,
} from "@hydraw/document";
import type { Rectangle, Shape, TextShape, Connector } from "@hydraw/document";
import { createImagePainter } from "./render-images.ts";
import type { ImagePainter } from "./render-images.ts";
import { renderGuides } from "./render-guides.ts";
import { drawConnector, drawConnectorHandles } from "./render-connectors.ts";
import { labelBackdropBounds, labelClipBounds, labelTextShape } from "../labels.ts";
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
  fontFamily = TEXT_FONT_FAMILY,
): void {
  ctx.save();
  ctx.translate(shape.x * camera.zoom + camera.x, shape.y * camera.zoom + camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.font = `${shape.fontWeight} ${shape.fontSize}px ${fontFamily}`;
  ctx.fillStyle = shape.color;
  ctx.textBaseline = "top";
  ctx.textAlign = shape.textAlign;
  const layout = textLayout(shape, fontFamily);
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
  palette: ReturnType<typeof themePalette>,
): void {
  const label = labelTextShape(owner, shapes, measure, palette.fontFamily);
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
    const backing = labelBackdropBounds(label, measure, palette.fontFamily);
    ctx.fillStyle = palette.background;
    ctx.fillRect(
      backing.x * camera.zoom + camera.x,
      backing.y * camera.zoom + camera.y,
      backing.width * camera.zoom,
      Math.min(backing.height, clip.height) * camera.zoom,
    );
  } else ctx.globalAlpha = rectangleAppearance(owner).opacity / 100;
  drawText(
    ctx,
    { ...label, color: palette.objectText(label) },
    camera,
    textLayout,
    palette.fontFamily,
  );
  ctx.restore();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  camera: Camera,
  viewport: Viewport,
  textLayout: TextLayouter,
  fontFamily: string,
  images: ImagePainter,
): void {
  if (shape.type === "ink") {
    drawInk(ctx, shape, camera);
    return;
  }
  if (shape.type === "image") {
    images.draw(ctx, shape, camera);
    return;
  }
  if (shape.type === "rectangle") drawRectangle(ctx, shape, camera, viewport);
  else if (
    shape.x * camera.zoom + camera.x <= viewport.width &&
    shape.y * camera.zoom + camera.y <= viewport.height &&
    (shape.x + shape.width) * camera.zoom + camera.x >= 0 &&
    (shape.y + shape.height) * camera.zoom + camera.y >= 0
  )
    drawText(ctx, shape, camera, textLayout, fontFamily);
}

/** Draws a derived scene. It cannot subscribe, dispatch commands or mutate editor state. */
function renderScene(
  ctx: CanvasRenderingContext2D,
  snapshot: EditorSnapshot,
  viewport: Viewport,
  textLayout: TextLayouter,
  measure: TextMeasurer,
  images: ImagePainter,
): void {
  const { width, height, dpr } = viewport;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { camera, selectedId } = snapshot;
  const theme = snapshot.document.theme;
  const palette = themePalette(theme);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);
  let spacing = 24 * camera.zoom;
  while (spacing < 14) spacing *= 2;
  ctx.fillStyle = palette.grid;
  for (let x = ((camera.x % spacing) + spacing) % spacing; x < width; x += spacing) {
    for (let y = ((camera.y % spacing) + spacing) % spacing; y < height; y += spacing)
      ctx.fillRect(x, y, 1.2, 1.2);
  }
  const selectedScene = selectionScene(snapshot);
  const sceneShapes = selectedScene.shapes.map((shape) => themedShape(shape, theme));
  const sceneConnectors = selectedScene.connectors.map((connector) =>
    themedConnector(connector, theme),
  );
  const resolveConnector = createConnectorResolver(sceneShapes);
  const selectedIds = new Set(snapshot.selectedIds);
  for (const object of sceneObjects({
    ...snapshot.document,
    shapes: sceneShapes,
    connectors: sceneConnectors,
  })) {
    if (object.type === "connector") {
      drawConnector(
        ctx,
        object,
        resolveConnector,
        camera,
        selectedIds.has(object.id) || object.id === snapshot.connectorPreview?.id,
      );
      if (snapshot.textEditing?.ownerId !== object.id)
        drawLabel(ctx, object, sceneShapes, camera, textLayout, measure, palette);
    } else {
      if (snapshot.textEditing?.ownerId || snapshot.textEditing?.draft.id !== object.id)
        drawShape(ctx, object, camera, viewport, textLayout, palette.fontFamily, images);
      if (object.type === "rectangle" && snapshot.textEditing?.ownerId !== object.id)
        drawLabel(ctx, object, sceneShapes, camera, textLayout, measure, palette);
    }
  }
  const selectedConnector =
    snapshot.connectorPreview ?? sceneConnectors.find((connector) => connector.id === selectedId);
  if (
    selectedConnector &&
    !selectedConnector.locked &&
    (snapshot.tool === "select" || snapshot.connectorPreview)
  )
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
  renderGuides(ctx, snapshot.guides, camera);
  drawSelection(ctx, snapshot, sceneShapes, sceneConnectors);
  if (snapshot.tool === "eraser" && snapshot.eraserCursor) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(snapshot.eraserCursor.x, snapshot.eraserCursor.y, 12, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "#364152";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

/** Per-canvas caches share the renderer's font metrics and live only as long as the adapter. */
export function createSceneRenderer(
  ctx: CanvasRenderingContext2D,
  schedule: () => void = () => {},
) {
  const measure = createTextMeasurer(ctx);
  const textLayout = createTextLayouter(measure);
  const images = createImagePainter(schedule);
  const render = (snapshot: EditorSnapshot, viewport: Viewport): void => {
    images.retain(
      new Set(
        snapshot.document.shapes.flatMap((shape) => (shape.type === "image" ? [shape.src] : [])),
      ),
    );
    renderScene(ctx, snapshot, viewport, textLayout, measure, images);
  };
  return Object.assign(render, { dispose: () => images.dispose() });
}
