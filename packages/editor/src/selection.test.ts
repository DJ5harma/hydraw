import { describe, expect, it } from "vite-plus/test";
import { createDocument, MAX_SHAPES, resolveConnector } from "@hydraw/document";
import type { Connector, Rectangle } from "@hydraw/document";
import { Editor } from "./index.ts";
import { selectionBounds, selectionScene } from "./selection.ts";

const a: Rectangle = {
  id: "a",
  type: "rectangle",
  x: 100,
  y: 100,
  width: 100,
  height: 80,
  fill: "#e7eefb",
};
const b: Rectangle = { ...a, id: "b", x: 400 };
const outside: Rectangle = { ...a, id: "outside", x: 750, y: 400 };
const edge: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "b" },
  color: "#243e33",
  arrowhead: "arrow",
};
const free: Connector = {
  ...edge,
  id: "free",
  start: { type: "point", x: 200, y: 400 },
  end: { type: "point", x: 350, y: 400 },
};
function setup() {
  let next = 0;
  return new Editor(
    { ...createDocument(), shapes: [a, b, outside], connectors: [edge, free] },
    () => `copy-${++next}`,
  );
}

describe("selection state and gestures", () => {
  it("toggles membership without history and derives single-object tools from exact membership", () => {
    const editor = setup();
    editor.select("a");
    editor.select("b", true);
    expect(editor.getSnapshot().selectedIds).toEqual(["a", "b"]);
    expect(editor.getSnapshot().selectedId).toBeNull();
    expect(editor.getResizeHandleAt({ x: 100, y: 100 })).toBeNull();
    editor.begin({ x: 150, y: 140 }, false, true);
    editor.finish();
    expect(editor.getSnapshot().selectedIds).toEqual(["b"]);
    expect(editor.getSnapshot().selectedId).toBe("b");
    editor.selectMany(["a", "a", "edge", "missing"]);
    expect(editor.getSnapshot().selectedIds).toEqual(["a", "edge"]);
    expect(editor.getSnapshot().canUndo).toBe(false);
  });
  it("marquees enclosed objects in either direction and restores prior selection on cancellation", () => {
    const editor = setup();
    editor.select("outside");
    editor.begin({ x: 650, y: 250 });
    editor.move({ x: 80, y: 80 });
    expect(editor.getSnapshot().selectedIds).toEqual(["a", "b", "edge"]);
    expect(editor.getSnapshot().marquee).toEqual({ x: 80, y: 80, width: 570, height: 170 });
    editor.cancelGesture();
    expect(editor.getSnapshot().selectedIds).toEqual(["outside"]);
    editor.begin({ x: 80, y: 80 }, false, true);
    editor.move({ x: 650, y: 250 });
    editor.finish();
    expect(editor.getSnapshot().selectedIds).toEqual(["outside", "a", "b", "edge"]);
    expect(editor.getSnapshot().revision).toBe(0);
    expect(editor.getSnapshot().marquee).toBeNull();
    editor.begin({ x: 20, y: 20 });
    editor.finish();
    expect(editor.getSnapshot().selectedIds).toEqual([]);
  });
  it("moves a mixed group once at zoom, renders live bindings and cancels without changing saved records", () => {
    const editor = setup();
    editor.selectMany(["a", "b", "edge", "free"]);
    editor.zoomAt({ x: 0, y: 0 }, 2);
    const original = editor.getSnapshot().document;
    editor.begin({ x: 300, y: 280 });
    const chrome = editor.getChromeSnapshot();
    editor.move({ x: 340, y: 300 });
    expect(editor.getChromeSnapshot()).toBe(chrome);
    expect(editor.getSnapshot().document).toBe(original);
    const scene = selectionScene(editor.getSnapshot());
    expect(scene.shapes[0]).toMatchObject({ x: 120, y: 110 });
    expect(resolveConnector(edge, scene.shapes)).toMatchObject({
      start: { x: 220, y: 150 },
      end: { x: 420, y: 150 },
    });
    expect(scene.connectors[1]).toMatchObject({
      start: { x: 220, y: 410 },
      end: { x: 370, y: 410 },
    });
    editor.cancelGesture();
    expect(editor.getSnapshot().document).toBe(original);
    expect(editor.getSnapshot().selectedIds).toEqual(["a", "b", "edge", "free"]);
    editor.begin({ x: 300, y: 280 });
    editor.move({ x: 340, y: 300 });
    editor.finish();
    expect(editor.getSnapshot().revision).toBe(1);
    const moved = editor.getSnapshot().document;
    editor.undo();
    expect(editor.getSnapshot().document).toEqual(original);
    editor.redo();
    expect(editor.getSnapshot().document).toEqual(moved);
    editor.nudgeSelection(10, -1);
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ x: 130, y: 109 });
  });
  it("duplicates and selects the independent graph, removes it in one undo, and preserves redo on a no-op", () => {
    const editor = setup();
    editor.selectMany(["a", "b"]);
    const original = editor.getSnapshot().document;
    editor.duplicateSelection();
    expect(editor.getSnapshot().revision).toBe(1);
    expect(editor.getSnapshot().selectedIds).toEqual(["copy-1", "copy-2", "copy-3"]);
    const copied = editor.getSnapshot().document;
    expect(copied.connectors[2]).toMatchObject({
      start: { shapeId: "copy-1" },
      end: { shapeId: "copy-2" },
    });
    editor.undo();
    expect(editor.getSnapshot().document).toEqual(original);
    expect(editor.getSnapshot().selectedIds).toEqual([]);
    editor.duplicateSelection();
    expect(editor.getSnapshot().canRedo).toBe(true);
    editor.redo();
    expect(editor.getSnapshot().document).toEqual(copied);
    editor.selectAll();
    editor.removeSelection();
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
    editor.undo();
    expect(editor.getSnapshot().document).toEqual(copied);
  });
  it("bounds mixed selections with lines and nodes and avoids group resizing", () => {
    const editor = setup();
    editor.selectMany(["a", "free"]);
    const scene = selectionScene(editor.getSnapshot());
    expect(
      selectionBounds(scene.shapes, scene.connectors, editor.getSnapshot().selectedIds),
    ).toEqual({ x: 100, y: 100, width: 250, height: 300 });
    expect(selectionBounds(scene.shapes, scene.connectors, [])).toBeNull();
    editor.setGeometry({ width: 200 });
    expect(editor.getSnapshot().revision).toBe(0);
  });
  it("cancels a marquee before taking a replacement lease and clears selection on replacement", () => {
    const editor = setup();
    editor.selectMany(["a", "b"]);
    editor.begin({ x: 80, y: 80 });
    editor.move({ x: 650, y: 250 });
    const lease = editor.lockDocument();
    expect(editor.getSnapshot().selectedIds).toEqual(["a", "b"]);
    expect(editor.getSnapshot().marquee).toBeNull();
    expect(() => editor.duplicateSelection()).toThrow("replacement");
    expect(() => editor.nudgeSelection(1, 0)).toThrow("replacement");
    expect(() => editor.removeSelection()).toThrow("replacement");
    lease.replace(createDocument());
    lease.release();
    expect(editor.getSnapshot().selectedIds).toEqual([]);
    expect(editor.getSnapshot().canUndo).toBe(false);
  });
  it("leaves selection and history intact if duplication exceeds capacity", () => {
    const editor = new Editor({
      ...createDocument(),
      shapes: Array.from({ length: MAX_SHAPES }, (_, index) => ({ ...a, id: `node-${index}` })),
    });
    editor.select("node-0");
    const before = editor.getSnapshot();
    expect(() => editor.duplicateSelection()).toThrow("not enough room");
    expect(editor.getSnapshot()).toBe(before);
  });
});
