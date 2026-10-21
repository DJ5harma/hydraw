import { expect, it } from "vite-plus/test";
import {
  createDocument,
  frameContents,
  isFrame,
  parseDocument,
  serializeDocument,
} from "@hydraw/document";
import { Editor } from "./editor.ts";
import { hitSceneObject, endpointAt } from "./connector-interactions.ts";
import { exportSvg } from "./svg-export.ts";

function setup() {
  let id = 0;
  return new Editor(
    createDocument(),
    () => `id-${++id}`,
    (text) => text.length * 10,
  );
}
it("frames a preset, moves enclosed objects once and keeps contents on frame deletion", () => {
  const editor = setup();
  editor.insertPreset("request-flow", { x: 600, y: 350 });
  const before = editor.getSnapshot().document;
  editor.frameSelection();
  editor.renameFrame("Request path");
  const framed = editor.getSnapshot().document;
  const frame = framed.shapes.find(isFrame)!;
  expect(frameContents(framed, frame.id)).toHaveLength(5);
  expect(hitSceneObject(framed, { x: frame.x + 8, y: frame.y + 8 }, 3, true)).toBeUndefined();
  expect(hitSceneObject(framed, { x: frame.x + 20, y: frame.y - 20 }, 3, true)?.id).toBe(frame.id);
  expect(endpointAt(framed.shapes, { x: frame.x, y: frame.y }, 10).type).toBe("point");
  editor.setGeometry({ width: frame.width + 100 });
  expect(editor.getSnapshot().document.shapes.filter((shape) => !isFrame(shape))).toEqual(
    before.shapes,
  );
  editor.undo();
  editor.nudgeSelection(20, 10);
  expect(editor.getSnapshot().document.shapes.map((s) => [s.x, s.y])).toEqual(
    framed.shapes.map((s) => [s.x + 20, s.y + 10]),
  );
  editor.undo();
  expect(editor.getSnapshot().document).toEqual(framed);
  editor.removeSelection();
  expect(editor.getSnapshot().document.shapes).toEqual(before.shapes);
  expect(editor.getSnapshot().document.connectors).toEqual(before.connectors);
  editor.undo();
  expect(parseDocument(serializeDocument(editor.getSnapshot().document))).toEqual(framed);
});
it("includes enclosed graph and names in frame exports and copies", () => {
  const editor = setup();
  editor.insertPreset("async-worker", { x: 600, y: 350 });
  editor.frameSelection();
  editor.renameFrame("Async work");
  const snapshot = editor.getSnapshot();
  const svg = exportSvg(snapshot.document, {
    ids: snapshot.selectedIds,
    measureText: (text) => text.length * 10,
  });
  expect(svg).toContain("Async work");
  expect(svg).toContain("Queue");
  expect(svg).toContain("Worker");
  const fragment = editor.copySelection()!;
  editor.pasteSelection(fragment, { x: 600, y: 900 });
  expect(editor.getSnapshot().document.shapes.filter(isFrame)).toHaveLength(2);
  expect(editor.getSnapshot().document.shapes).toHaveLength(8);
  expect(editor.getSnapshot().document.connectors).toHaveLength(4);
});
it("selects locked contents on canvas for unlock while preventing frame movement", () => {
  const editor = setup();
  editor.addRectangle({ x: 500, y: 300 });
  const node = editor.getSnapshot().selectedId!;
  editor.frameSelection();
  const frame = editor.getSnapshot().selectedId!;
  editor.select(node);
  editor.setSelectionLocked(true);
  editor.select(frame);
  const before = editor.getSnapshot().document;
  editor.nudgeSelection(20, 0);
  expect(editor.getSnapshot().document).toBe(before);
  editor.begin({ x: 500, y: 300 });
  editor.move({ x: 520, y: 300 });
  editor.finish();
  expect(editor.getSnapshot().selectedId).toBe(node);
  expect(editor.getSnapshot().document).toBe(before);
  editor.setSelectionLocked(false);
  editor.select(frame);
  editor.nudgeSelection(20, 0);
  expect(editor.getSnapshot().document.shapes[0]!.x).toBe(before.shapes[0]!.x + 20);
});

it("draws an empty named frame with a transparent interior", () => {
  const editor = setup();
  editor.setShapeKind("frame");
  editor.begin({ x: 300, y: 200 });
  editor.move({ x: 800, y: 600 });
  expect(editor.getSnapshot().preview).toMatchObject({
    kind: "frame",
    fill: "transparent",
    label: { text: "Frame 1" },
  });
  editor.finish();
  expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
    kind: "frame",
    width: 500,
    height: 400,
  });
  editor.undo();
  expect(editor.getSnapshot().document.shapes).toEqual([]);
});
