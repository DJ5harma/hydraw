import { resolveConnector } from "@hydraw/document";
import type { Bounds, Connector, Rectangle, Shape, TextShape } from "@hydraw/document";
import { layoutText } from "./text-layout.ts";
import type { TextMeasurer } from "./text-layout.ts";

/** Inscribed content area: labels never resize their owners or change connection geometry. */
export function labelClipBounds(owner: Rectangle | Connector, shapes: readonly Shape[]): Bounds {
  if (owner.type === "connector") {
    const { start, end } = resolveConnector(owner, shapes);
    const width = Math.min(220, Math.max(80, Math.hypot(end.x - start.x, end.y - start.y) * 0.8));
    return {
      x: (start.x + end.x) / 2 - width / 2,
      y: (start.y + end.y) / 2 - 40,
      width,
      height: 80,
    };
  }
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
    textAlign: "center",
  };
  const { height } = layoutText(draft, measure);
  return { ...draft, height, y: box.y + Math.max(0, (box.height - height) / 2) };
}
