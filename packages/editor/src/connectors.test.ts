import { selectionScene } from "./selection.ts";
import { describe, expect, it } from "vite-plus/test";
import { createDocument, resolveConnector } from "@hydraw/document";
import type { Connector, Rectangle, TextShape } from "@hydraw/document";
import { Editor } from "./index.ts";

const a: Rectangle = {
  id: "a",
  type: "rectangle",
  x: 100,
  y: 200,
  width: 180,
  height: 120,
  fill: "#e7eefb",
};
const b: Rectangle = { ...a, id: "b", x: 550 };
const c: Rectangle = { ...a, id: "c", x: 750, y: 450 };
const bound: Connector = {
  id: "bound",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "b" },
  color: "#243e33",
  arrowhead: "arrow",
};
function setup(connectors: readonly Connector[] = []) {
  let id = 0;
  return new Editor({ ...createDocument(), shapes: [a, b, c], connectors }, () => `edge-${++id}`);
}
const edge = (editor: Editor) => editor.getSnapshot().document.connectors[0]!;

describe("connector interactions", () => {
  it("draws one transaction at zoom, binds both ends and follows moved and resized nodes without rewriting edges", () => {
    const editor = setup();
    editor.zoomAt({ x: 0, y: 0 }, 2);
    editor.setTool("connector");
    editor.begin({ x: 380, y: 520 });
    const chrome = editor.getChromeSnapshot();
    editor.move({ x: 1280, y: 520 });
    expect(editor.getChromeSnapshot()).toBe(chrome);
    expect(editor.getSnapshot().bindingTargetId).toBe("b");
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
    editor.finish();
    expect(editor.getSnapshot().revision).toBe(1);
    expect(edge(editor)).toMatchObject({
      start: { type: "binding", shapeId: "a" },
      end: { type: "binding", shapeId: "b" },
    });
    const original = edge(editor);
    editor.select("a");
    editor.begin({ x: 380, y: 520 });
    editor.move({ x: 460, y: 520 });
    const snapshot = editor.getSnapshot();
    expect(resolveConnector(original, selectionScene(snapshot).shapes).start).toEqual({
      x: 320,
      y: 260,
    });
    editor.finish();
    editor.setGeometry({ width: 240 });
    expect(edge(editor)).toBe(original);
    expect(resolveConnector(original, editor.getSnapshot().document.shapes)).toEqual({
      start: { x: 380, y: 260 },
      end: { x: 550, y: 260 },
    });
    editor.undo();
    editor.undo();
    editor.undo();
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
    editor.redo();
    expect(edge(editor)).toEqual(original);
  });
  it("creates a connected node at an empty drop, selects it for typing, and undoes node plus edge together", () => {
    let nextId = 0;
    const editor = new Editor(
      { ...createDocument(), shapes: [a] },
      () => `created-${++nextId}`,
      (value) => value.length * 10,
    );
    editor.select("a");
    expect(editor.getConnectionHandleAt({ x: 280, y: 260 })).toBe(true);
    editor.begin({ x: 280, y: 260 });
    editor.move({ x: 480, y: 260 });
    editor.finish();
    const document = editor.getSnapshot().document;
    expect(document.shapes).toHaveLength(2);
    expect(document.shapes[1]).toMatchObject({
      type: "rectangle",
      x: 390,
      y: 200,
      width: 180,
      height: 120,
    });
    expect(document.connectors).toHaveLength(1);
    expect(document.connectors[0]).toMatchObject({
      start: { type: "binding", shapeId: "a" },
      end: { type: "binding", shapeId: "created-1" },
    });
    expect(editor.getSnapshot()).toMatchObject({
      selectedId: "created-1",
      textEditing: { ownerId: "created-1" },
    });
    editor.cancelTextEditing();
    editor.undo();
    expect(editor.getSnapshot().document.shapes).toEqual([a]);
    expect(editor.getSnapshot().document.connectors).toEqual([]);
  });
  it("connects an existing target from a selected shape handle without creating a node", () => {
    let nextId = 0;
    const editor = new Editor({ ...createDocument(), shapes: [a, b] }, () => `created-${++nextId}`);
    editor.select("a");
    editor.begin({ x: 280, y: 260 });
    editor.move({ x: 550, y: 260 });
    editor.finish();
    expect(editor.getSnapshot().document.shapes).toEqual([a, b]);
    expect(editor.getSnapshot().document.connectors[0]).toMatchObject({
      start: { type: "binding", shapeId: "a" },
      end: { type: "binding", shapeId: "b" },
    });
  });
  it("reconnects endpoint handles to nodes and canvas points, with cancellation and self-binding rejection", () => {
    const editor = setup([bound]);
    editor.select("bound");
    expect(editor.getConnectorEndpointAt({ x: 550, y: 260 })).toBe("end");
    editor.begin({ x: 550, y: 260 });
    editor.move({ x: 900, y: 350 });
    expect(editor.getSnapshot().connectorPreview?.end).toEqual({ type: "point", x: 900, y: 350 });
    editor.cancelGesture();
    expect(edge(editor)).toEqual(bound);
    expect(editor.getSnapshot().revision).toBe(0);
    editor.begin({ x: 550, y: 260 });
    editor.move({ x: 800, y: 500 });
    editor.finish();
    expect(edge(editor).end).toEqual({ type: "binding", shapeId: "c" });
    editor.undo();
    editor.begin({ x: 550, y: 260 });
    editor.move({ x: 190, y: 260 });
    editor.finish();
    expect(edge(editor)).toEqual(bound);
    expect(editor.getSnapshot().canRedo).toBe(true);
    editor.begin({ x: 550, y: 260 });
    editor.move({ x: 900, y: 350 });
    editor.finish();
    expect(edge(editor).end).toEqual({ type: "point", x: 900, y: 350 });
  });
  it("keeps bound bodies fixed and moves detached arrows as one shape at zoom", () => {
    const editor = setup([bound]);
    editor.begin({ x: 400, y: 260 });
    editor.move({ x: 450, y: 280 });
    editor.finish();
    expect(editor.getSnapshot().selectedId).toBe("bound");
    editor.nudgeSelection(10, 10);
    expect(editor.getSnapshot().revision).toBe(0);
    editor.detachConnector();
    expect(edge(editor)).toMatchObject({
      start: { type: "point", x: 280, y: 260 },
      end: { type: "point", x: 550, y: 260 },
    });
    editor.zoomAt({ x: 0, y: 0 }, 2);
    editor.begin({ x: 800, y: 520 });
    editor.move({ x: 840, y: 540 });
    editor.finish();
    expect(edge(editor)).toMatchObject({ start: { x: 300, y: 270 }, end: { x: 570, y: 270 } });
    editor.nudgeSelection(10, -1);
    expect(edge(editor)).toMatchObject({ start: { x: 310, y: 269 }, end: { x: 580, y: 269 } });
    editor.undo();
    editor.undo();
    editor.undo();
    expect(edge(editor)).toEqual(bound);
  });
  it("cascades attached connectors when text is cleared and restores text and edges in one undo", () => {
    const text: TextShape = {
      id: "text",
      type: "text",
      text: "A label",
      x: 100,
      y: 200,
      width: 180,
      height: 42,
      fontSize: 24,
      fontWeight: 400,
      textAlign: "left",
      color: "#243e33",
    };
    const connector = { ...bound, start: { type: "binding" as const, shapeId: "text" } };
    const editor = new Editor(
      { ...createDocument(), shapes: [text, b], connectors: [connector] },
      undefined,
      (value) => value.length * 10,
    );
    editor.select("text");
    editor.editText();
    editor.updateTextDraft("");
    editor.finishTextEditing();
    expect(editor.getSnapshot().document.shapes).toEqual([b]);
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
    editor.undo();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ text: "A label" });
    expect(edge(editor)).toEqual(connector);
    editor.select("b");
    editor.removeSelection();
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
    editor.undo();
    expect(edge(editor)).toEqual(connector);
  });
  it("styles, reverses and deletes an arrow through shared history and excludes document edits during replacement", () => {
    const editor = setup([bound]);
    editor.select("bound");
    editor.setConnectorStyle({ color: "#3568db", arrowhead: "none" });
    editor.reverseConnector();
    expect(edge(editor)).toMatchObject({
      color: "#3568db",
      arrowhead: "none",
      start: bound.end,
      end: bound.start,
    });
    editor.removeSelection();
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
    editor.undo();
    editor.select("bound");
    editor.undo();
    editor.undo();
    expect(edge(editor)).toEqual(bound);
    const lease = editor.lockDocument();
    expect(() => editor.detachConnector()).toThrow("replacement");
    expect(() => editor.setConnectorStyle({ color: "#3568db" })).toThrow("replacement");
    expect(() => editor.addConnector({ x: 0, y: 0 })).toThrow("replacement");
    editor.setTool("connector");
    editor.begin({ x: 0, y: 0 });
    expect(editor.getSnapshot().connectorPreview).toBeNull();
    lease.release();
  });
  it("detaches boundary attachments without losing their positions and clamps whole-arrow movement", () => {
    const nodes = [
      { ...a, x: 1_000_000 },
      { ...b, x: 1_000_000, y: 600 },
    ];
    const editor = new Editor({ ...createDocument(), shapes: nodes, connectors: [bound] });
    editor.select("bound");
    const ends = resolveConnector(bound, nodes);
    editor.detachConnector();
    expect(edge(editor).start).toEqual({ type: "point", ...ends.start });
    expect(edge(editor).end).toEqual({ type: "point", ...ends.end });
    editor.nudgeSelection(10_000_000, 0);
    const moved = edge(editor);
    expect(moved.start.type === "point" && moved.start.x).toBe(2_000_000);
    expect(moved.end.type === "point" && moved.end.x).toBe(2_000_000);
  });

  it("discards click-sized and self-bound drawing without creating history", () => {
    const editor = setup();
    editor.setTool("connector");
    editor.begin({ x: 190, y: 260 });
    editor.move({ x: 200, y: 270 });
    editor.finish();
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
    editor.begin({ x: 20, y: 20 });
    editor.move({ x: 22, y: 22 });
    editor.finish();
    expect(editor.getSnapshot().canUndo).toBe(false);
    editor.begin({ x: 20, y: 20 });
    editor.move({ x: 70, y: 70 });
    editor.cancelGesture();
    expect(editor.getSnapshot().revision).toBe(0);
  });
});
