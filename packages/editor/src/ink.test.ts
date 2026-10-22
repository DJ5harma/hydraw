import { describe, expect, it } from "vite-plus/test";
import { createDocument } from "@hydraw/document";
import { MAX_SIZE } from "@hydraw/document";
import { Editor } from "./editor.ts";

const box = [
  { x: 10, y: 10 },
  { x: 40, y: 10 },
  { x: 70, y: 10 },
  { x: 100, y: 10 },
  { x: 100, y: 40 },
  { x: 100, y: 70 },
  { x: 100, y: 100 },
  { x: 70, y: 100 },
  { x: 40, y: 100 },
  { x: 10, y: 100 },
  { x: 10, y: 70 },
  { x: 10, y: 40 },
  { x: 10, y: 10 },
];

function setup() {
  let id = 0;
  const editor = new Editor(createDocument(), () => `ink-${++id}`);
  editor.setTool("draw");
  return editor;
}

describe("freehand editing", () => {
  it("commits a raw stroke as one undoable shape while keeping draw active", () => {
    const editor = setup();
    editor.begin({ x: 10, y: 10 });
    for (const point of box.slice(1)) editor.move(point);
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    editor.finish();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
      type: "ink",
      id: "ink-1",
      color: "#202124",
      strokeWidth: 3,
      points: expect.any(Array),
    });
    expect(editor.getSnapshot().tool).toBe("draw");
    expect(editor.getSnapshot().revision).toBe(1);
    editor.undo();
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
  });

  it("keeps total stroke extents within the document size limit", () => {
    const editor = setup();
    editor.begin({ x: 0, y: 0 });
    editor.move({ x: -MAX_SIZE, y: 0 });
    editor.move({ x: MAX_SIZE, y: 0 });
    expect(editor.getSnapshot().preview).toMatchObject({ x: -MAX_SIZE, width: MAX_SIZE });
    editor.finish();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
      x: -MAX_SIZE,
      width: MAX_SIZE,
    });
  });

  it("promotes a held closed path, then resumes the raw stroke after movement", () => {
    const editor = setup();
    editor.begin(box[0]!);
    for (const point of box.slice(1)) editor.move(point);
    expect(editor.recognizeDrawing()).toBe(true);
    expect(editor.getSnapshot().preview).toMatchObject({
      type: "rectangle",
      appearance: { stroke: "#202124" },
    });
    editor.move({ x: 14, y: 10 });
    expect(editor.getSnapshot().preview?.type).toBe("ink");
    editor.finish();
    expect(editor.getSnapshot().document.shapes[0]?.type).toBe("ink");
  });

  it("persists a recognized rectangle with source ink styling and cancels without history", () => {
    const editor = setup();
    editor.setInkStyle({ color: "#3568db", strokeWidth: 5 });
    editor.begin(box[0]!);
    for (const point of box.slice(1)) editor.move(point);
    expect(editor.recognizeDrawing()).toBe(true);
    editor.finish();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
      type: "rectangle",
      appearance: { stroke: "#3568db", strokeWidth: 5 },
    });
    const revision = editor.getSnapshot().revision;
    editor.begin({ x: 200, y: 200 });
    editor.move({ x: 240, y: 200 });
    editor.cancelGesture();
    expect(editor.getSnapshot().revision).toBe(revision);
    expect(editor.getSnapshot().document.shapes).toHaveLength(1);
  });

  it("styles selected ink without resetting omitted properties and respects locks", () => {
    const editor = setup();
    editor.setInkStyle({ color: "#3568db", strokeWidth: 5 });
    editor.begin({ x: 10, y: 10 });
    editor.move({ x: 30, y: 20 });
    editor.finish();
    editor.select("ink-1");
    editor.setInkStyle({ strokeWidth: 7 });
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
      color: "#3568db",
      strokeWidth: 7,
    });
    editor.setInkStyle({ color: "#8d315a" });
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
      color: "#8d315a",
      strokeWidth: 7,
    });
    editor.setSelectionLocked(true);
    const revision = editor.getSnapshot().revision;
    editor.setInkStyle({ color: "#243e33", strokeWidth: 3 });
    expect(editor.getSnapshot().revision).toBe(revision);
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
      color: "#8d315a",
      strokeWidth: 7,
      locked: true,
    });
  });
});
