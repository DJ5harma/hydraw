import { rectangleAppearance, resolveConnector } from "@hydraw/document";
import type {
  BoardDocument,
  Bounds,
  Connector,
  Rectangle,
  Shape,
  TextShape,
} from "@hydraw/document";
import { labelBackdropBounds, labelClipBounds, labelTextShape } from "./labels.ts";
import { layoutText, TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT, TEXT_PADDING } from "./text-layout.ts";
import type { TextMeasurer } from "./text-layout.ts";

export type SvgExportOptions = Readonly<{
  ids?: readonly string[];
  padding?: number;
  background?: string;
  measureText: TextMeasurer;
}>;

const DEFAULT_PADDING = 24;

function escapeXml(value: string): string {
  const xmlSafe = Array.from(value, (character) => {
    const code = character.codePointAt(0)!;
    return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      (code >= 0xd800 && code <= 0xdfff)
      ? "\ufffd"
      : character;
  }).join("");
  return xmlSafe.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

function number(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(4))) : "0";
}

function safePadding(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_PADDING;
  return Math.max(0, Math.min(value, 2_000));
}

function safeBackground(value: string | undefined): string | null {
  if (value === undefined || value === "transparent") return null;
  if (/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) return value;
  throw new Error("SVG background must be a hex color or transparent.");
}

function unions(bounds: Bounds[]): Bounds {
  if (bounds.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const left = Math.min(...bounds.map((item) => item.x));
  const top = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function selectedContent(document: BoardDocument, ids?: readonly string[]) {
  if (ids === undefined)
    return { shapes: [...document.shapes], connectors: [...document.connectors] };
  const selected = new Set(ids);
  return {
    shapes: document.shapes.filter((shape) => selected.has(shape.id)),
    connectors: document.connectors.filter((connector) => selected.has(connector.id)),
  };
}

function outline(appearance: ReturnType<typeof rectangleAppearance>): string {
  const dash =
    appearance.strokeStyle === "dashed"
      ? ` stroke-dasharray="${number(appearance.strokeWidth * 5)} ${number(appearance.strokeWidth * 3)}"`
      : appearance.strokeStyle === "dotted"
        ? ` stroke-dasharray="${number(appearance.strokeWidth)} ${number(appearance.strokeWidth * 3)}" stroke-linecap="round"`
        : "";
  return `stroke="${escapeXml(appearance.stroke)}" stroke-width="${number(appearance.strokeWidth)}"${dash}`;
}

function rectangleElement(shape: Rectangle): string {
  const appearance = rectangleAppearance(shape);
  const fill = shape.fill === "transparent" ? "none" : escapeXml(shape.fill);
  const common = `fill="${fill}" ${outline(appearance)} opacity="${number(appearance.opacity / 100)}"`;
  const kind = shape.kind ?? "rectangle";
  if (kind === "ellipse")
    return `<ellipse ${common} cx="${number(shape.x + shape.width / 2)}" cy="${number(shape.y + shape.height / 2)}" rx="${number(shape.width / 2)}" ry="${number(shape.height / 2)}"/>`;
  if (kind === "diamond")
    return `<polygon ${common} points="${number(shape.x + shape.width / 2)},${number(shape.y)} ${number(shape.x + shape.width)},${number(shape.y + shape.height / 2)} ${number(shape.x + shape.width / 2)},${number(shape.y + shape.height)} ${number(shape.x)},${number(shape.y + shape.height / 2)}"/>`;
  return `<rect ${common} x="${number(shape.x)}" y="${number(shape.y)}" width="${number(shape.width)}" height="${number(shape.height)}" rx="${number(Math.min(appearance.cornerRadius, shape.width / 2, shape.height / 2))}"/>`;
}

function textElements(shape: TextShape, measure: TextMeasurer, clipId?: string): string {
  const layout = layoutText(shape, measure);
  const x =
    shape.textAlign === "left"
      ? shape.x + TEXT_PADDING
      : shape.textAlign === "center"
        ? shape.x + shape.width / 2
        : shape.x + shape.width - TEXT_PADDING;
  const anchor =
    shape.textAlign === "left" ? "start" : shape.textAlign === "center" ? "middle" : "end";
  const clip = clipId ? ` clip-path="url(#${escapeXml(clipId)})"` : "";
  const text = layout.lines
    .map(
      (line, index) =>
        `<tspan x="${number(x)}" y="${number(shape.y + TEXT_PADDING + index * shape.fontSize * TEXT_LINE_HEIGHT + shape.fontSize * 0.15)}" dominant-baseline="text-before-edge">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return `<text${clip} font-family="${escapeXml(TEXT_FONT_FAMILY)}" font-size="${number(shape.fontSize)}" font-weight="${shape.fontWeight}" text-anchor="${anchor}" fill="${escapeXml(shape.color)}">${text}</text>`;
}

function labelElements(
  owner: Rectangle | Connector,
  shapes: readonly Shape[],
  measure: TextMeasurer,
  key: string,
): { svg: string; defs?: string } {
  const label = labelTextShape(owner, shapes, measure);
  if (!label) return { svg: "" };
  const clipBounds = labelClipBounds(owner, shapes);
  const clipId = `label-clip-${key}`;
  const defs = `<clipPath id="${escapeXml(clipId)}"><rect x="${number(clipBounds.x)}" y="${number(clipBounds.y)}" width="${number(clipBounds.width)}" height="${number(clipBounds.height)}"/></clipPath>`;
  const backing = labelBackdropBounds(label, measure);
  const background =
    owner.type === "connector"
      ? `<rect x="${number(backing.x)}" y="${number(backing.y)}" width="${number(backing.width)}" height="${number(Math.min(backing.height, clipBounds.height))}" fill="#ffffff"/>`
      : "";
  return {
    svg: `<g opacity="${number(owner.type === "rectangle" ? rectangleAppearance(owner).opacity / 100 : 1)}">${background}${textElements(label, measure, clipId)}</g>`,
    defs,
  };
}

function connectorElement(connector: Connector, shapes: readonly Shape[]): string {
  const { start, end } = resolveConnector(connector, shapes);
  const line = `<path d="M ${number(start.x)} ${number(start.y)} L ${number(end.x)} ${number(end.y)}" fill="none" stroke="${escapeXml(connector.color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (connector.arrowhead !== "arrow") return line;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length <= 0) return line;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = Math.min(11, length / 2);
  const point = (theta: number) => ({
    x: end.x - Math.cos(theta) * size,
    y: end.y - Math.sin(theta) * size,
  });
  const first = point(angle - Math.PI / 6);
  const second = point(angle + Math.PI / 6);
  const arrow = `<path d="M ${number(first.x)} ${number(first.y)} L ${number(end.x)} ${number(end.y)} L ${number(second.x)} ${number(second.y)}" fill="none" stroke="${escapeXml(connector.color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  return line + arrow;
}

function connectorBounds(connector: Connector, shapes: readonly Shape[]): Bounds {
  const { start, end } = resolveConnector(connector, shapes);
  const radius = connector.arrowhead === "arrow" ? 12 : 1;
  const left = Math.min(start.x, end.x) - radius;
  const top = Math.min(start.y, end.y) - radius;
  return {
    x: left,
    y: top,
    width: Math.max(1, Math.abs(end.x - start.x) + radius * 2),
    height: Math.max(1, Math.abs(end.y - start.y) + radius * 2),
  };
}

/** Serialize only document semantics; no DOM or browser APIs are accessed. */
export function exportSvg(document: BoardDocument, options: SvgExportOptions): string {
  const padding = safePadding(options.padding);
  const background = safeBackground(options.background);
  const content = selectedContent(document, options.ids);
  const itemBounds: Bounds[] = content.shapes.map((shape) => {
    if (shape.type === "text") {
      const layout = layoutText(shape, options.measureText);
      return {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: Math.max(shape.height, layout.height),
      };
    }
    const halfStroke = rectangleAppearance(shape).strokeWidth / 2;
    return {
      x: shape.x - halfStroke,
      y: shape.y - halfStroke,
      width: shape.width + halfStroke * 2,
      height: shape.height + halfStroke * 2,
    };
  });
  for (const shape of content.shapes) {
    if (shape.type === "rectangle") {
      const label = labelTextShape(shape, document.shapes, options.measureText);
      if (label) itemBounds.push(labelClipBounds(shape, document.shapes));
    }
  }
  for (const connector of content.connectors) {
    itemBounds.push(connectorBounds(connector, document.shapes));
    const label = labelTextShape(connector, document.shapes, options.measureText);
    if (label) itemBounds.push(labelClipBounds(connector, document.shapes));
  }
  const bounds = unions(itemBounds);
  const x = bounds.x - padding;
  const y = bounds.y - padding;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;
  const scene: string[] = [];
  if (background)
    scene.push(
      `<rect x="${number(x)}" y="${number(y)}" width="${number(width)}" height="${number(height)}" fill="${escapeXml(background)}"/>`,
    );
  const labelDefs: string[] = [];
  let labelIndex = 0;
  for (const connector of content.connectors) {
    scene.push(connectorElement(connector, document.shapes));
    const label = labelElements(
      connector,
      document.shapes,
      options.measureText,
      String(labelIndex++),
    );
    if (label.svg) {
      if (label.defs) labelDefs.push(label.defs);
      scene.push(label.svg);
    }
  }
  for (const shape of content.shapes) {
    if (shape.type === "rectangle") {
      scene.push(rectangleElement(shape));
      const label = labelElements(
        shape,
        document.shapes,
        options.measureText,
        String(labelIndex++),
      );
      if (label.svg) {
        if (label.defs) labelDefs.push(label.defs);
        scene.push(label.svg);
      }
    } else {
      scene.push(textElements(shape, options.measureText));
    }
  }
  const defs = labelDefs.length ? `<defs>${labelDefs.join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="${number(x)} ${number(y)} ${number(width)} ${number(height)}">${defs}${scene.join("")}</svg>`;
}
