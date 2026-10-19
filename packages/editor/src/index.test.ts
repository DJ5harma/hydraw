import { describe, expect, it } from "vite-plus/test";
import { createDocument } from "@hydraw/document";
import { Editor, screenToWorld } from "./index.ts";

function setup() {
  let id = 0;
  return new Editor(createDocument(), () => `shape-${++id}`);
}

describe("editor transactions", () => {
  it("requires an active replacement lease and does not let an old release unlock a newer lease", () => {
    const editor = setup();
    editor.addRectangle({ x: 100, y: 100 });
    const first = editor.lockDocument();
    first.release();
    const second = editor.lockDocument();
    first.release();
    expect(() => editor.rename("Blocked")).toThrow("replacement");
    expect(() => first.replace(createDocument())).toThrow("released");
    second.replace({ ...createDocument(), name: "Replacement" });
    expect(editor.getSnapshot().canUndo).toBe(false);
    second.release();
    editor.rename("Editable");
    expect(editor.getSnapshot().document.name).toBe("Editable");
  });
  it("commits a zoomed resize once, cancels previews, and restores dimensions through history", () => {
    const editor = setup();
    editor.addRectangle({ x: 200, y: 150 });
    editor.zoomAt({ x: 0, y: 0 }, 2);
    // Rectangle is [110, 90, 180, 120] in world coordinates.
    editor.begin({ x: 580, y: 420 });
    editor.move({ x: 680, y: 480 });
    expect(editor.getSnapshot().document.shapes[0]?.width).toBe(180);
    expect(editor.getSnapshot().preview).toMatchObject({ width: 230, height: 150 });
    expect(editor.getSnapshot().revision).toBe(1);
    editor.finish();
    expect(editor.getSnapshot().revision).toBe(2);
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ width: 230, height: 150 });
    editor.undo();
    expect(editor.getSnapshot().document.shapes[0]?.width).toBe(180);
    editor.redo();
    editor.begin({ x: 680, y: 480 });
    editor.move({ x: 800, y: 600 });
    editor.cancelGesture();
    expect(editor.getSnapshot().document.shapes[0]?.width).toBe(230);
    expect(editor.getSnapshot().revision).toBe(4);
  });
  it("does not create history for no-op edits and rejects invalid geometry atomically", () => {
    const editor = setup();
    editor.addRectangle({ x: 200, y: 150 });
    editor.setFill("#f7e4ed");
    editor.undo();
    editor.setGeometry({ width: 180 });
    editor.nudgeSelection(0, 0);
    expect(editor.getSnapshot().revision).toBe(3);
    expect(editor.getSnapshot().canRedo).toBe(true);
    expect(() => editor.setGeometry({ width: 0 })).toThrow("invalid");
    expect(editor.getSnapshot().document.shapes[0]?.width).toBe(180);
    expect(editor.getSnapshot().canRedo).toBe(true);
  });
  it("keeps control snapshots stable through preview frames and camera panning", () => {
    const editor = setup();
    editor.setTool("rectangle");
    editor.begin({ x: 20, y: 20 });
    const chrome = editor.getChromeSnapshot();
    editor.move({ x: 120, y: 100 });
    expect(editor.getChromeSnapshot()).toBe(chrome);
    editor.cancelGesture();
    const idle = editor.getChromeSnapshot();
    editor.pan(20, 40);
    expect(editor.getChromeSnapshot()).toBe(idle);
  });
  it("records one committed change for a full drag and cancels without a history entry", () => {
    const editor = setup();
    editor.setTool("rectangle");
    editor.begin({ x: 200, y: 150 });
    for (let i = 0; i < 50; i++) editor.move({ x: i, y: i });
    expect(editor.getSnapshot().revision).toBe(0);
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    editor.move({ x: 100, y: 50 });
    editor.finish();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
      x: 100,
      y: 50,
      width: 100,
      height: 100,
    });
    expect(editor.getSnapshot().revision).toBe(1);
    editor.undo();
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    editor.redo();
    editor.begin({ x: 110, y: 60 });
    editor.move({ x: 250, y: 250 });
    editor.cancelGesture();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ x: 100, y: 50 });
    expect(editor.getSnapshot().revision).toBe(3);
  });
  it("preserves the world point under the zoom anchor and moves in world coordinates", () => {
    const editor = setup();
    const anchor = { x: 300, y: 200 };
    editor.addRectangle(anchor);
    editor.zoomAt(anchor, 2);
    expect(screenToWorld(anchor, editor.getSnapshot().camera)).toEqual(anchor);
    editor.begin(anchor);
    editor.move({ x: 340, y: 220 });
    editor.finish();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ x: 230, y: 150 });
  });
  it("invalidates redo on a new edit and restores color/delete in order", () => {
    const editor = setup();
    editor.addRectangle({ x: 100, y: 100 });
    editor.setFill("#f7e4ed");
    editor.removeSelection();
    editor.undo();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ fill: "#f7e4ed" });
    editor.undo();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ fill: "#e7eefb" });
    editor.addRectangle({ x: 400, y: 400 });
    expect(editor.getSnapshot().canRedo).toBe(false);
  });
  it("ignores click-sized rectangles at high zoom and does not save camera changes", () => {
    const editor = setup();
    editor.zoomAt({ x: 0, y: 0 }, 4);
    editor.setTool("rectangle");
    editor.begin({ x: 20, y: 20 });
    editor.move({ x: 23, y: 23 });
    editor.finish();
    editor.pan(40, 40);
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    expect(editor.getSnapshot().revision).toBe(0);
  });
});
