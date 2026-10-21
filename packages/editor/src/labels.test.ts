import { expect, it } from "vite-plus/test";
import {
  createDocument,
  decodeDocument,
  hitTest,
  resolveConnector,
  serializeDocument,
  parseDocument,
} from "@hydraw/document";
import { Editor } from "./editor.ts";
import { labelTextShape } from "./labels.ts";
const measure = (text: string, style: { fontSize: number }) =>
  Array.from(text).length * style.fontSize * 0.5;

it("keeps a node label attached through movement, resize, duplicate, save, clear and undo", () => {
  let id = 0;
  const editor = new Editor(createDocument(), () => `id-${++id}`, measure);
  editor.setShapeKind("ellipse");
  editor.addRectangle({ x: 300, y: 200 });
  const owner = editor.getSnapshot().selectedId!;
  editor.editText();
  editor.updateTextDraft("API gateway");
  editor.finishTextEditing();
  editor.nudgeSelection(40, 20);
  editor.setGeometry({ width: 220 });
  editor.duplicateSelection();
  const document = editor.getSnapshot().document;
  expect(document.shapes).toHaveLength(2);
  expect(document.shapes[1]).toMatchObject({ kind: "ellipse", label: { text: "API gateway" } });
  expect(parseDocument(serializeDocument(document))).toEqual(document);
  editor.editText();
  editor.updateTextDraft("");
  editor.finishTextEditing();
  expect(editor.getSnapshot().document.shapes).toHaveLength(2);
  expect(editor.getSnapshot().document.shapes[1]).not.toHaveProperty("label");
  editor.undo();
  expect(editor.getSnapshot().document).toEqual(document);
  editor.select(owner);
  editor.editText();
  editor.updateTextDraft("Cancel");
  editor.cancelTextEditing();
  expect(editor.getSnapshot().document).toEqual(document);
});
it("labels a connector without changing bindings or endpoints and migrates v3", () => {
  const earlier = { ...createDocument(), version: 3 };
  expect(decodeDocument(earlier).version).toBe(5);
  const editor = new Editor(createDocument(), () => "edge", measure);
  editor.addConnector({ x: 200, y: 300 });
  const before = editor.getSnapshot().document.connectors[0]!;
  editor.editText();
  editor.updateTextDraft("HTTPS");
  editor.finishTextEditing();
  expect(editor.getSnapshot().document.connectors[0]).toMatchObject({
    ...before,
    label: { text: "HTTPS" },
  });
  const label = labelTextShape(editor.getSnapshot().document.connectors[0]!, [], measure)!;
  expect(label.x + label.width / 2).toBe(200);
  editor.undo();
  expect(editor.getSnapshot().document.connectors[0]).toEqual(before);
});
it("hits ellipse and diamond silhouettes and resolves their actual perimeters", () => {
  const base = {
    id: "n",
    type: "rectangle" as const,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fill: "#ffffff" as const,
  };
  for (const kind of ["ellipse", "diamond"] as const) {
    const node = { ...base, kind };
    expect(hitTest([node], { x: 1, y: 1 })).toBeUndefined();
    expect(hitTest([node], { x: 50, y: 50 })?.id).toBe("n");
    const edge = {
      id: "e",
      type: "connector" as const,
      start: { type: "binding" as const, shapeId: "n" },
      end: { type: "point" as const, x: 150, y: 150 },
      color: "#243e33" as const,
      arrowhead: "arrow" as const,
    };
    const point = resolveConnector(edge, [node]).start;
    expect(point.x).toBeCloseTo(kind === "ellipse" ? 85.355339 : 75);
    expect(point.y).toBeCloseTo(point.x);
  }
});
