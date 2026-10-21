import { expect, it } from "vite-plus/test";
import { createDocument, decodeDocument, parseDocument, serializeDocument } from "@hydraw/document";
import { Editor } from "./editor.ts";
import { hitSceneObject } from "./connector-interactions.ts";
import { exportSvg } from "./svg-export.ts";

const board = () =>
  decodeDocument({
    ...createDocument(),
    shapes: [
      { id: "a", type: "rectangle", x: 300, y: 200, width: 100, height: 80, fill: "#e7eefb" },
      { id: "b", type: "rectangle", x: 500, y: 280, width: 100, height: 80, fill: "#e7eefb" },
      { id: "c", type: "rectangle", x: 700, y: 200, width: 100, height: 80, fill: "#e7eefb" },
    ],
  });
const editor = () => {
  let id = 0;
  return new Editor(board(), () => `new-${++id}`);
};

it("expands group selection, moves it atomically and round-trips metadata", () => {
  const e = editor();
  e.selectMany(["a", "b"]);
  e.groupSelection();
  const grouped = e.getSnapshot().document;
  e.select("a");
  expect(e.getSnapshot().selectedIds).toEqual(["a", "b"]);
  e.nudgeSelection(20, 10);
  expect(e.getSnapshot().document.shapes.slice(0, 2)).toMatchObject([
    { x: 320, y: 210 },
    { x: 520, y: 290 },
  ]);
  e.undo();
  expect(e.getSnapshot().document).toEqual(grouped);
  expect(parseDocument(serializeDocument(grouped))).toEqual(grouped);
  e.undo();
  expect(e.getSnapshot().document).toEqual(board());
  e.redo();
  expect(e.getSnapshot().document).toEqual(grouped);
});

it("protects locked groups while allowing explicit selection and undoable unlocking", () => {
  const e = editor();
  e.selectMany(["a", "b"]);
  e.groupSelection();
  e.setSelectionLocked(true);
  const locked = e.getSnapshot().document;
  e.nudgeSelection(20, 0);
  e.setFill("#ffffff");
  e.removeSelection();
  e.ungroupSelection();
  e.orderSelection("front");
  expect(e.getSnapshot().document).toBe(locked);
  e.select(null);
  e.begin({ x: 350, y: 240 });
  e.move({ x: 370, y: 260 });
  e.finish();
  expect(e.getSnapshot().selectedIds).toEqual(["a", "b"]);
  expect(e.getSnapshot().document).toBe(locked);
  e.selectAll();
  expect(e.getSnapshot().selectedIds).toEqual(["c"]);
  e.select("a");
  e.setSelectionLocked(false);
  expect(
    e
      .getSnapshot()
      .document.shapes.slice(0, 2)
      .every((s) => !s.locked),
  ).toBe(true);
  e.undo();
  expect(e.getSnapshot().document).toEqual(locked);
});

it("duplicates and pastes groups with fresh membership independent of their source", () => {
  const e = editor();
  e.selectMany(["a", "b"]);
  e.groupSelection();
  const originalGroup = e.getSnapshot().document.shapes[0]!.groupId;
  e.duplicateSelection();
  const copies = e.getSnapshot().document.shapes.slice(3);
  expect(copies).toHaveLength(2);
  expect(copies[0]!.groupId).toBe(copies[1]!.groupId);
  expect(copies[0]!.groupId).not.toBe(originalGroup);
  e.setSelectionLocked(true);
  const fragment = e.copySelection()!;
  e.pasteSelection(fragment, { x: 900, y: 500 });
  const pasted = e.getSnapshot().document.shapes.slice(5);
  expect(pasted[0]!.groupId).toBe(pasted[1]!.groupId);
  expect([originalGroup, copies[0]!.groupId]).not.toContain(pasted[0]!.groupId);
  expect(pasted.every((s) => !s.locked)).toBe(true);
});

it("snaps moves transiently, supports bypass and clears guides after one history step", () => {
  const e = editor();
  e.begin({ x: 550, y: 320 });
  e.move({ x: 550, y: 243 });
  expect(e.getSnapshot().selectionPreview!.shapes[0]!.y).toBe(200);
  expect(e.getSnapshot().guides.length).toBeGreaterThan(0);
  e.move({ x: 550, y: 243 }, false);
  expect(e.getSnapshot().selectionPreview!.shapes[0]!.y).toBe(203);
  expect(e.getSnapshot().guides).toEqual([]);
  e.move({ x: 550, y: 243 });
  e.finish();
  expect(e.getSnapshot().document.shapes[1]!.y).toBe(200);
  expect(e.getSnapshot().guides).toEqual([]);
  e.undo();
  expect(e.getSnapshot().document).toEqual(board());
  e.nudgeSelection(0, -77);
  const positioned = e.getSnapshot().document;
  e.begin({ x: 550, y: 243 });
  e.move({ x: 550, y: 243 });
  e.finish();
  expect(e.getSnapshot().document).toBe(positioned);
});

it("uses the same cross-type stack for selection and SVG export", () => {
  const document = decodeDocument({
    ...board(),
    connectors: [
      {
        id: "edge",
        type: "connector",
        start: { type: "point", x: 300, y: 240 },
        end: { type: "point", x: 400, y: 240 },
        color: "#243e33",
        arrowhead: "none",
      },
    ],
  });
  const e = new Editor(document);
  expect(hitSceneObject(document, { x: 350, y: 240 }, 7)?.id).toBe("a");
  e.select("edge");
  e.orderSelection("front");
  const reordered = e.getSnapshot().document;
  expect(hitSceneObject(reordered, { x: 350, y: 240 }, 7)?.id).toBe("edge");
  const svg = exportSvg(reordered, { measureText: (text) => text.length * 12 });
  expect(svg.lastIndexOf("<path")).toBeGreaterThan(svg.lastIndexOf("<rect"));
  e.undo();
  expect(e.getSnapshot().document).toEqual(document);
});
