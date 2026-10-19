import { describe, expect, it } from "vite-plus/test";
import { createDocument, resolveConnector } from "@hydraw/document";
import type { Connector, Rectangle } from "@hydraw/document";
import { Editor } from "./index.ts";
const a: Rectangle = {
  id: "a",
  type: "rectangle",
  x: 100,
  y: 80,
  width: 100,
  height: 80,
  fill: "#e7eefb",
};
const b: Rectangle = { ...a, id: "b", x: 400, y: 280, width: 200, height: 100 };
const c: Rectangle = { ...a, id: "c", x: 260, y: 180, width: 120, height: 42 };
const edge: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "b" },
  color: "#243e33",
  arrowhead: "arrow",
};
const setup = () => new Editor({ ...createDocument(), shapes: [a, b, c], connectors: [edge] });

describe("editor arrangement commands", () => {
  it("aligns in one revision, preserves selection and bindings, and round-trips history", () => {
    const editor = setup();
    editor.selectAll();
    const before = editor.getSnapshot();
    editor.alignSelection("left");
    const aligned = editor.getSnapshot();
    expect(aligned.revision).toBe(1);
    expect(aligned.selectedIds).toBe(before.selectedIds);
    expect(aligned.document.shapes.map((shape) => shape.x)).toEqual([100, 100, 100]);
    expect(aligned.document.connectors[0]).toBe(before.document.connectors[0]);
    expect(resolveConnector(edge, aligned.document.shapes)).not.toEqual(
      resolveConnector(edge, before.document.shapes),
    );
    editor.undo();
    expect(editor.getSnapshot().document).toEqual(before.document);
    editor.redo();
    expect(editor.getSnapshot().document).toEqual(aligned.document);
  });
  it("distributes centers once and preserves redo when an arrangement is already satisfied or ineligible", () => {
    const editor = setup();
    editor.selectAll();
    editor.distributeSelection("horizontal");
    expect(editor.getSnapshot().document.shapes[2]?.x).toBe(265);
    expect(editor.getSnapshot().revision).toBe(1);
    editor.distributeSelection("horizontal");
    expect(editor.getSnapshot().revision).toBe(1);
    editor.undo();
    editor.selectMany(["a", "edge"]);
    editor.alignSelection("left");
    editor.distributeSelection("horizontal");
    expect(editor.getSnapshot().canRedo).toBe(true);
    editor.selectAll();
    editor.alignSelection("left");
    editor.alignSelection("right");
    editor.undo();
    const revision = editor.getSnapshot().revision;
    editor.alignSelection("left");
    expect(editor.getSnapshot().revision).toBe(revision);
    expect(editor.getSnapshot().canRedo).toBe(true);
  });
  it("cancels movement previews before arranging committed records and honors replacement locks", () => {
    const editor = setup();
    editor.selectAll();
    editor.begin({ x: 150, y: 120 });
    editor.move({ x: 180, y: 150 });
    expect(editor.getSnapshot().selectionPreview).not.toBeNull();
    editor.alignSelection("left");
    expect(editor.getSnapshot().selectionPreview).toBeNull();
    expect(editor.getSnapshot().document.shapes.map((shape) => shape.x)).toEqual([100, 100, 100]);
    expect(editor.getSnapshot().document.shapes[0]?.y).toBe(80);
    const lease = editor.lockDocument();
    expect(() => editor.alignSelection("top")).toThrow("replacement");
    expect(() => editor.distributeSelection("horizontal")).toThrow("replacement");
    lease.release();
  });
  it("leaves the current document, selection and history untouched on a coordinate-limit failure", () => {
    const editor = new Editor({
      ...createDocument(),
      shapes: [
        { ...a, x: 1_000_000, width: 100_000 },
        { ...b, x: 900_000, width: 100 },
      ],
    });
    editor.selectAll();
    const before = editor.getSnapshot();
    expect(() => editor.alignSelection("right")).toThrow("coordinate limit");
    expect(editor.getSnapshot()).toBe(before);
    expect(editor.getSnapshot().canUndo).toBe(false);
  });
});
