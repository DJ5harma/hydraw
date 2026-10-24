import { resolveConnector, connectorMidpoint } from "@hydraw/document";
import type {
  Bounds,
  Connector,
  ConnectorGeometry,
  Rectangle,
  Shape,
  TextShape,
} from "@hydraw/document";
import { layoutText } from "./text-layout.ts";
import type { TextMeasurer } from "./text-layout.ts";

/** Inscribed content area: labels never resize their owners or change connection geometry. */
export function labelClipBounds(
  owner: Rectangle | Connector,
  shapes: readonly Shape[],
  resolved?: ConnectorGeometry,
): Bounds {
  if (owner.type === "connector") {
    const geometry = resolved ?? resolveConnector(owner, shapes);
    const middle = connectorMidpoint(geometry);
    const length = geometry.points
      .slice(1)
      .reduce(
        (sum, point, i) =>
          sum + Math.hypot(point.x - geometry.points[i]!.x, point.y - geometry.points[i]!.y),
        0,
      );
    const width = Math.min(220, Math.max(80, length * 0.8));
    return {
      x: middle.x - width / 2,
      y: middle.y - 40,
      width,
      height: 80,
    };
  }
  if (owner.kind === "frame")
    return { x: owner.x, y: owner.y - 42, width: owner.width, height: 42 };
  const ratio = owner.kind === "diamond" ? 0.5 : owner.kind === "ellipse" ? 0.7 : 1;
  const width = Math.max(1, owner.width * ratio - 16),
    height = Math.max(1, owner.height * ratio - 16);
  return {
    x: owner.x + (owner.width - width) / 2,
    y: owner.y + (owner.height - height) / 2,
    width,
    height,
  };
}

export function labelTextShape(
  owner: Rectangle | Connector,
  shapes: readonly Shape[],
  measure: TextMeasurer,
  fontFamily?: string,
): TextShape | null {
  const label = owner.label;
  if (!label) return null;
  const box = labelClipBounds(owner, shapes);
  const draft: TextShape = {
    id: owner.id,
    type: "text",
    ...box,
    text: label.text,
    fontSize: label.fontSize,
    fontWeight: label.fontWeight,
    color: label.color,
    textAlign: owner.type === "rectangle" && owner.kind === "frame" ? "left" : "center",
  };
  const { height } = layoutText(draft, measure, fontFamily);
  return { ...draft, height, y: box.y + Math.max(0, (box.height - height) / 2) };
}

/** Back only the visible caption, not its entire wrapping area. */
export function labelBackdropBounds(
  label: TextShape,
  measure: TextMeasurer,
  fontFamily?: string,
): Bounds {
  const layout = layoutText(label, measure, fontFamily);
  const width = Math.min(
    label.width,
    Math.max(1, ...layout.lines.map((line) => measure(line, { ...label, fontFamily }))) + 8,
  );
  return { x: label.x + (label.width - width) / 2, y: label.y, width, height: label.height };
}
