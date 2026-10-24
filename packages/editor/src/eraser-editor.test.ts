import { describe, expect, it } from "vite-plus/test";
import { createDocument, makeInkShape } from "@hydraw/document";
import type { Connector, InkShape, Rectangle, Shape } from "@hydraw/document";
import { Editor } from "./editor.ts";

function ink(id = "stroke", overrides: Partial<InkShape> = {}): InkShape {
  return {
    ...makeInkShape(
      id,
      [
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ],
      "#202124",
      2,
    )!,
    ...overrides,
  };
}

const attached: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: "stroke" },
  end: { type: "point", x: 200, y: 50 },
  color: "#243e33",
  arrowhead: "arrow",
};

function setup(shapes: readonly Shape[] = [ink()], connectors: readonly Connector[] = []) {
  const editor = new Editor({ ...createDocument(), shapes, connectors });
  editor.setTool("eraser");
  return editor;
}

describe("whole-stroke eraser", () => {
  it("sweeps across paths skipped by fast movement and deletes attached connectors atomically", () => {
    const editor = setup([ink()], [attached]);
    editor.begin({ x: 0, y: 50 });
    editor.move({ x: 100, y: 50 });
    expect(editor.getSnapshot().erasedIds).toEqual(["stroke"]);
    expect(editor.getSnapshot().document.shapes).toHaveLength(1);
    editor.finish();
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
    expect(editor.getSnapshot().revision).toBe(1);
    editor.undo();
    expect(editor.getSnapshot().document.shapes).toHaveLength(1);
    expect(editor.getSnapshot().document.connectors).toHaveLength(1);
  });

  it("cancels transient erasure without changing history and protects locked strokes", () => {
    const editor = setup([ink()]);
    const document = editor.getSnapshot().document;
    editor.begin({ x: 0, y: 50 });
    editor.move({ x: 100, y: 50 });
    expect(editor.getSnapshot().erasedIds).toEqual(["stroke"]);
    editor.cancelGesture();
    expect(editor.getSnapshot().document).toBe(document);
    expect(editor.getSnapshot().erasedIds).toEqual([]);
    expect(editor.getSnapshot().revision).toBe(0);

    const locked = setup([ink("stroke", { locked: true })]);
    locked.begin({ x: 0, y: 50 });
    locked.move({ x: 100, y: 50 });
    expect(locked.getSnapshot().erasedIds).toEqual([]);
    locked.finish();
    expect(locked.getSnapshot().document.shapes).toHaveLength(1);
    expect(locked.getSnapshot().revision).toBe(0);
  });

  it("protects strokes in locked groups and leaves unrelated objects intact", () => {
    const groupedInk = ink("stroke", { groupId: "group" });
    const lockedMember: Rectangle = {
      id: "locked",
      type: "rectangle",
      x: 20,
      y: 20,
      width: 20,
      height: 20,
      fill: "transparent",
      groupId: "group",
      locked: true,
    };
    const editor = setup([groupedInk, lockedMember]);
    editor.begin({ x: 0, y: 50 });
    editor.move({ x: 100, y: 50 });
    expect(editor.getSnapshot().erasedIds).toEqual([]);
    editor.finish();
    expect(editor.getSnapshot().document.shapes).toHaveLength(2);
  });
});
