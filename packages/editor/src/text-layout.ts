import type { TextShape } from "@hydraw/document";

/** Browser font metrics are injected; the engine itself never touches a canvas or DOM. */
export type TextMeasurer = (
  text: string,
  style: Pick<TextShape, "fontSize" | "fontWeight"> & Readonly<{ fontFamily?: string }>,
) => number;
export const TEXT_FONT_FAMILY = "Arial, sans-serif";
export const TEXT_LINE_HEIGHT = 1.4;
export const TEXT_PADDING = 4;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function layoutText(shape: TextShape, measure: TextMeasurer, fontFamily = TEXT_FONT_FAMILY) {
  const available = Math.max(1, shape.width - TEXT_PADDING * 2);
  const lines: string[] = [];
  for (const paragraph of shape.text.split("\n")) {
    let line = "";
    // Keep words together where possible, then break long tokens at grapheme boundaries.
    for (const token of paragraph.match(/\S+\s*|\s+/gu) ?? []) {
      if (line && measure(line + token.trimEnd(), { ...shape, fontFamily }) > available) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const { segment } of graphemes.segment(token)) {
        if (
          line &&
          segment.trim() &&
          measure(line + segment, { ...shape, fontFamily }) > available
        ) {
          lines.push(line.trimEnd());
          line = "";
        }
        line += segment;
      }
    }
    lines.push(line.trimEnd());
  }
  return {
    lines,
    height: Math.max(1, lines.length * shape.fontSize * TEXT_LINE_HEIGHT + TEXT_PADDING * 2),
  };
}

export type TextLayouter = (shape: TextShape, fontFamily?: string) => ReturnType<typeof layoutText>;

/** Immutable records are safe cache keys; old documents are collectable with their layouts. */
export function createTextLayouter(measure: TextMeasurer): TextLayouter {
  const layouts = new WeakMap<TextShape, Map<string, ReturnType<typeof layoutText>>>();
  return (shape, fontFamily = TEXT_FONT_FAMILY) => {
    let byFont = layouts.get(shape);
    if (!byFont) {
      byFont = new Map();
      layouts.set(shape, byFont);
    }
    let layout = byFont.get(fontFamily);
    if (!layout) {
      layout = layoutText(shape, measure, fontFamily);
      byFont.set(fontFamily, layout);
    }
    return layout;
  };
}
