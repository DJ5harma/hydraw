import {
  frameSelectionContents,
  rectangleAppearance,
  resolveConnector,
  sceneObjects,
  themePalette,
  themedShape,
  themedConnector,
} from "@hydraw/document";
import type {
  BoardTheme,
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
  const selected = new Set(frameSelectionContents(document, ids));
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

function textElements(
  shape: TextShape,
  measure: TextMeasurer,
  clipId?: string,
  fontFamily = TEXT_FONT_FAMILY,
): string {
  const layout = layoutText(shape, measure, fontFamily);
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
  return `<text${clip} font-family="${escapeXml(fontFamily)}" font-size="${number(shape.fontSize)}" font-weight="${shape.fontWeight}" text-anchor="${anchor}" fill="${escapeXml(shape.color)}">${text}</text>`;
}

function labelElements(
  owner: Rectangle | Connector,
  shapes: readonly Shape[],
  measure: TextMeasurer,
  key: string,
  fontFamily: string,
  theme: BoardTheme,
): { svg: string; defs?: string } {
  const label = labelTextShape(owner, shapes, measure, fontFamily);
  if (!label) return { svg: "" };
  const clipBounds = labelClipBounds(owner, shapes);
  const clipId = `label-clip-${key}`;
  const defs = `<clipPath id="${escapeXml(clipId)}"><rect x="${number(clipBounds.x)}" y="${number(clipBounds.y)}" width="${number(clipBounds.width)}" height="${number(clipBounds.height)}"/></clipPath>`;
  const backing = labelBackdropBounds(label, measure, fontFamily);
  const background =
    owner.type === "connector"
      ? `<rect x="${number(backing.x)}" y="${number(backing.y)}" width="${number(backing.width)}" height="${number(Math.min(backing.height, clipBounds.height))}" fill="${themePalette(theme).background}"/>`
      : "";
  return {
    svg: `<g opacity="${number(owner.type === "rectangle" ? rectangleAppearance(owner).opacity / 100 : 1)}">${background}${textElements({ ...label, color: themePalette(theme).objectText(label) }, measure, clipId, fontFamily)}</g>`,
    defs,
  };
}

function connectorElement(connector: Connector, shapes: readonly Shape[]): string {
  const { points, end } = resolveConnector(connector, shapes);
  const path = points
    .map((point, i) => `${i ? "L" : "M"} ${number(point.x)} ${number(point.y)}`)
    .join(" ");
  const line = `<path d="${path}" fill="none" stroke="${escapeXml(connector.color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (connector.arrowhead !== "arrow") return line;
  const beforeEnd = points.at(-2)!;
  const length = Math.hypot(end.x - beforeEnd.x, end.y - beforeEnd.y);
  if (length <= 0) return line;
  const angle = Math.atan2(end.y - beforeEnd.y, end.x - beforeEnd.x);
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
  const { points } = resolveConnector(connector, shapes);
  const radius = connector.arrowhead === "arrow" ? 12 : 1;
  const xs = points.map((point) => point.x),
    ys = points.map((point) => point.y);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  return {
    x: left - radius,
    y: top - radius,
    width: Math.max(1, Math.max(...xs) - left + radius * 2),
    height: Math.max(1, Math.max(...ys) - top + radius * 2),
  };
}

/** Serialize only document semantics; no DOM or browser APIs are accessed. */
export function exportSvg(document: BoardDocument, options: SvgExportOptions): string {
  const theme = document.theme;
  const palette = themePalette(theme);
  const padding = safePadding(options.padding);
  const background = safeBackground(
    options.background ?? (theme === "clean" ? undefined : palette.background),
  );
  const rawContent = selectedContent(document, options.ids);
  const content = {
    shapes: rawContent.shapes.map((shape) => themedShape(shape, theme)),
    connectors: rawContent.connectors.map((connector) => themedConnector(connector, theme)),
  };
  const itemBounds: Bounds[] = content.shapes.map((shape) => {
    if (shape.type === "text") {
      const layout = layoutText(shape, options.measureText, palette.fontFamily);
      return {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: Math.max(shape.height, layout.height),
      };
    }
    const halfStroke =
      shape.type === "rectangle"
        ? rectangleAppearance(shape).strokeWidth / 2
        : shape.type === "ink"
          ? shape.strokeWidth / 2
          : 0;
    return {
      x: shape.x - halfStroke,
      y: shape.y - halfStroke,
      width: shape.width + halfStroke * 2,
      height: shape.height + halfStroke * 2,
    };
  });
  for (const shape of content.shapes) {
    if (shape.type === "rectangle") {
      const label = labelTextShape(shape, document.shapes, options.measureText, palette.fontFamily);
      if (label) itemBounds.push(labelClipBounds(shape, document.shapes));
    }
  }
  for (const connector of content.connectors) {
    itemBounds.push(connectorBounds(connector, document.shapes));
    const label = labelTextShape(
      connector,
      document.shapes,
      options.measureText,
      palette.fontFamily,
    );
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
  for (const object of sceneObjects({
    ...document,
    shapes: content.shapes,
    connectors: content.connectors,
  })) {
    if (object.type === "connector") scene.push(connectorElement(object, document.shapes));
    else if (object.type === "rectangle") scene.push(rectangleElement(object));
    else if (object.type === "ink") {
      const first = object.points[0]!;
      const x = object.x + first.x * object.width,
        y = object.y + first.y * object.height;
      if (object.points.length === 1)
        scene.push(
          `<circle cx="${number(x)}" cy="${number(y)}" r="${number(object.strokeWidth / 2)}" fill="${object.color}"/>`,
        );
      else {
        const d = object.points
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${number(object.x + p.x * object.width)} ${number(object.y + p.y * object.height)}`,
          )
          .join(" ");
        scene.push(
          `<path d="${d}" fill="none" stroke="${object.color}" stroke-width="${number(object.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
      }
      continue;
    } else if (object.type === "image") {
      const crop = object.crop ?? { x: 0, y: 0, width: 1, height: 1 };
      const image = `<svg x="${number(object.x)}" y="${number(object.y)}" width="${number(object.width)}" height="${number(object.height)}" viewBox="${number(crop.x)} ${number(crop.y)} ${number(crop.width)} ${number(crop.height)}" preserveAspectRatio="none" overflow="hidden"><image x="0" y="0" width="1" height="1" preserveAspectRatio="none" href="${escapeXml(object.src)}"/></svg>`;
      scene.push(
        object.flipX || object.flipY
          ? `<g transform="translate(${number(object.flipX ? 2 * object.x + object.width : 0)} ${number(object.flipY ? 2 * object.y + object.height : 0)}) scale(${object.flipX ? -1 : 1} ${object.flipY ? -1 : 1})">${image}</g>`
          : image,
      );
      continue;
    } else {
      scene.push(textElements(object, options.measureText, undefined, palette.fontFamily));
      continue;
    }
    const label = labelElements(
      object,
      document.shapes,
      options.measureText,
      String(labelIndex++),
      palette.fontFamily,
      theme,
    );
    if (label.svg) {
      if (label.defs) labelDefs.push(label.defs);
      scene.push(label.svg);
    }
  }
  const defs = labelDefs.length ? `<defs>${labelDefs.join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="${number(x)} ${number(y)} ${number(width)} ${number(height)}">${defs}${scene.join("")}</svg>`;
}
