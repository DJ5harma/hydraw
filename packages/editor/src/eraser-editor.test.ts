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
  const editor = new Editor(
    { ...createDocument(), shapes, connectors },
    undefined,
    (text, style) => (text.length * style.fontSize) / 2,
  );
  editor.setTool("eraser");
  return editor;
}

describe("object eraser", () => {
  it("keeps the eraser cursor visible after release and cancellation", () => {
    const editor = setup();
    const point = { x: 50, y: 50 };
    editor.begin(point);
    editor.finish();
    expect(editor.getSnapshot().eraserCursor).toEqual(point);
    expect(editor.getSnapshot().interacting).toBe(false);
    editor.begin(point);
    editor.cancelGesture();
    expect(editor.getSnapshot().eraserCursor).toEqual(point);
    expect(editor.getSnapshot().interacting).toBe(false);
    editor.setTool("select");
    expect(editor.getSnapshot().eraserCursor).toBeNull();
  });

  it("sweeps across paths skipped by fast movement and deletes attached connectors atomically", () => {
    const editor = setup([ink()], [attached]);
    editor.begin({ x: 0, y: 50 });
    editor.move({ x: 100, y: 50 });
    expect(editor.getSnapshot().erasedIds).toEqual(["stroke", "edge"]);
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

  it("protects objects in locked groups", () => {
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

it("erases mixed objects and standalone connectors in one undoable sweep", () => {
  const bounds = { x: 20, y: 20, width: 20, height: 20 };
  const shapes: Shape[] = [
    { ...bounds, id: "box", type: "rectangle", fill: "transparent" },
    {
      ...bounds,
      x: 60,
      id: "text",
      type: "text",
      text: "hi",
      fontSize: 16,
      fontWeight: 400,
      textAlign: "left",
      color: "#202124",
    },
    {
      ...bounds,
      x: 100,
      id: "picture",
      type: "image",
      src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
      name: "picture",
    },
    { ...bounds, x: 140, id: "locked", type: "rectangle", fill: "transparent", locked: true },
    {
      ...bounds,
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      id: "frame",
      type: "rectangle",
      kind: "frame",
      fill: "transparent",
    },
  ];
  const edge: Connector = {
    ...attached,
    id: "free",
    start: { type: "point", x: 180, y: 10 },
    end: { type: "point", x: 180, y: 80 },
  };
  const editor = setup(shapes, [edge]);
  const original = editor.getSnapshot().document;
  editor.begin({ x: 20, y: 30 });
  editor.move({ x: 200, y: 30 });
  editor.finish();
  // Crossing objects inside a frame leaves the frame intact.
  expect(editor.getSnapshot().document.shapes.map((s) => s.id)).toEqual(["locked", "frame"]);
  expect(editor.getSnapshot().document.connectors).toHaveLength(0);
  editor.undo();
  expect(editor.getSnapshot().document.shapes).toEqual(original.shapes);
  expect(editor.getSnapshot().document.connectors).toEqual([edge]);
});

it("keeps locked connectors and their bound objects intact", () => {
  const editor = setup([ink()], [{ ...attached, locked: true }]);
  editor.begin({ x: 0, y: 50 });
  editor.move({ x: 250, y: 50 });
  editor.finish();
  expect(editor.getSnapshot().document.shapes).toHaveLength(1);
  expect(editor.getSnapshot().document.connectors).toHaveLength(1);
  expect(editor.getSnapshot().revision).toBe(0);
});
