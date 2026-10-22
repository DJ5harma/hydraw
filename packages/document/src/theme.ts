import type { BoardDocument, Connector, Rectangle, Shape, TextShape, TextColor } from "./model.ts";
import { rectangleAppearance } from "./appearance.ts";

export const BOARD_THEMES = ["clean", "notebook", "blueprint"] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];

export function isBoardTheme(value: unknown): value is BoardTheme {
  return BOARD_THEMES.some((theme) => theme === value);
}

export function boardTheme(document: Pick<BoardDocument, "theme">): BoardTheme {
  return document.theme ?? "clean";
}

export type ThemePalette = Readonly<{
  background: string;
  grid: string;
  text: string;
  shapeFill: (shape: Rectangle) => string;
  shapeStroke: (shape: Rectangle) => string;
  objectText: (shape: TextShape) => TextColor;
  connector: (connector: Connector) => TextColor;
  fontFamily: string;
}>;

const colors = ["#e7eefb", "#e6f2ea", "#fff0d5", "#f7e4ed", "#ffffff"];
const notebookColors = ["#e9eef5", "#e7eee6", "#f5edda", "#f1e5e8", "#fffdf5"];
const blueprintColors = ["#315d83", "#356b88", "#557b94", "#486b85", "#244d72"];
const sourceText = ["#243e33", "#3568db", "#8d315a", "#805d20", "#202124"];
const notebookText = ["#34483b", "#355f89", "#8a4057", "#795c2a", "#34332e"];
const blueprintText = ["#e8f5ff", "#c6e6ff", "#ffd5dc", "#ffe6a6", "#f2f8ff"];

function mapped(value: string, from: readonly string[], to: readonly string[]): string {
  const index = from.indexOf(value);
  return index < 0 ? value : (to[index] ?? value);
}

export function themePalette(theme: BoardTheme): ThemePalette {
  if (theme === "notebook")
    return {
      background: "#fffdf5",
      grid: "#e5dfce",
      text: "#34332e",
      shapeFill: (shape) => mapped(shape.fill, colors, notebookColors),
      shapeStroke: (shape) =>
        rectangleAppearance(shape).stroke === "#364152"
          ? "#77715f"
          : rectangleAppearance(shape).stroke,
      objectText: (shape) => mapped(shape.color, sourceText, notebookText) as TextColor,
      connector: (item) => mapped(item.color, sourceText, notebookText) as TextColor,
      fontFamily: "Georgia, 'Times New Roman', serif",
    };
  if (theme === "blueprint")
    return {
      background: "#173f63",
      grid: "#477398",
      text: "#f2f8ff",
      shapeFill: (shape) =>
        shape.fill === "transparent" ? "transparent" : mapped(shape.fill, colors, blueprintColors),
      shapeStroke: (shape) =>
        rectangleAppearance(shape).stroke === "#364152"
          ? "#c6e6ff"
          : rectangleAppearance(shape).stroke,
      objectText: (shape) => mapped(shape.color, sourceText, blueprintText) as TextColor,
      connector: (item) => mapped(item.color, sourceText, blueprintText) as TextColor,
      fontFamily: "Arial, sans-serif",
    };
  return {
    background: "#ffffff",
    grid: "#d5d9df",
    text: "#202124",
    shapeFill: (shape) => shape.fill,
    shapeStroke: (shape) => rectangleAppearance(shape).stroke,
    objectText: (shape) => shape.color,
    connector: (item) => item.color,
    fontFamily: "Arial, sans-serif",
  };
}

export function themedShape(shape: Shape, theme: BoardTheme): Shape {
  const palette = themePalette(theme);
  if (shape.type === "text") return { ...shape, color: palette.objectText(shape) };
  if (shape.type !== "rectangle") return shape;
  const appearance = rectangleAppearance(shape);
  return {
    ...shape,
    fill: palette.shapeFill(shape) as Rectangle["fill"],
    appearance: { ...appearance, stroke: palette.shapeStroke(shape) },
  };
}

export function themedConnector(connector: Connector, theme: BoardTheme): Connector {
  return { ...connector, color: themePalette(theme).connector(connector) as Connector["color"] };
}
