import { TEXT_FONT_FAMILY } from "../text-layout.ts";
import type { TextMeasurer } from "../text-layout.ts";

export function createTextMeasurer(
  context = document.createElement("canvas").getContext("2d"),
): TextMeasurer {
  if (!context) throw new Error("Your browser could not measure text.");
  return (text, style) => {
    context.font = `${style.fontWeight} ${style.fontSize}px ${TEXT_FONT_FAMILY}`;
    return context.measureText(text).width;
  };
}
