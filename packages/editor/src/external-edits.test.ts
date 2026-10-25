import { describe, expect, it } from "vite-plus/test";
import { createDocument, shapeTransaction } from "@hydraw/document";
import { Editor } from "./editor.ts";
import type { SessionOperation } from "./document-session.ts";

const a = {
  id: "a",
  type: "rectangle" as const,
  x: 20,
  y: 20,
  width: 100,
  height: 80,
  fill: "#e7eefb" as const,
};
const b = { ...a, id: "b", x: 300 };
const measure = (value: string) => value.length * 10;
function pair() {
  const board = { ...createDocument(), shapes: [a, b] };
  const left = new Editor(board, undefined, measure);
  const right = new Editor(board, undefined, measure);
  right.documentSession.subscribe(({ origin, operation }) => {
    if (origin !== "remote" && operation) left.applyExternal(operation);
  });
  return { left, right };
}

describe("external edit reconciliation", () => {
  it("preserves camera, selection and an unrelated ongoing gesture", () => {
    const { left, right } = pair();
    left.pan(20, 40);
    left.select(a.id);
    left.begin({ x: 70, y: 90 });
    left.move({ x: 90, y: 100 }, false);
    const before = left.getSnapshot();
    right.select(b.id);
    right.nudgeSelection(0, 50);
    expect(left.getSnapshot().camera).toBe(before.camera);
    expect(left.getSnapshot().selectedIds).toEqual([a.id]);
    expect(left.getSnapshot().selectionPreview).toBe(before.selectionPreview);
    expect(left.getSnapshot().interacting).toBe(true);
    left.finish();
    expect(left.getSnapshot().document.shapes).toMatchObject([{ x: 40, y: 30 }, { y: 70 }]);
  });

  it("cancels a conflicting gesture without committing its stale preview", () => {
    const { left, right } = pair();
    left.select(a.id);
    left.begin({ x: 50, y: 50 });
    left.move({ x: 100, y: 100 }, false);
    right.select(a.id);
    right.nudgeSelection(100, 0);
    expect(left.getSnapshot()).toMatchObject({
      interacting: false,
      selectionPreview: null,
      canUndo: false,
    });
    expect(left.getSnapshot().interactionNotice).toContain("cancelled");
    left.finish();
    expect(left.getSnapshot().document.shapes[0]?.x).toBe(120);
    expect(left.getSnapshot().revision).toBe(1);
  });

  it("prunes deleted selections and preserves a conflicting label draft for recovery", () => {
    const { left, right } = pair();
    left.select(a.id);
    left.editText();
    left.updateTextDraft("Keep my explanation");
    right.select(a.id);
    right.removeSelection();
    expect(left.getSnapshot()).toMatchObject({
      selectedIds: [],
      textEditing: null,
      recoveredTextDraft: "Keep my explanation",
    });
    expect(left.getSnapshot().document.shapes.map((shape) => shape.id)).toEqual([b.id]);
    left.finishTextEditing();
    expect(left.getSnapshot().document.shapes).toHaveLength(1);
    left.dismissInteractionNotice();
    expect(left.getSnapshot().recoveredTextDraft).toBeNull();
  });

  it("retains an unrelated label draft until it is explicitly committed", () => {
    const { left, right } = pair();
    left.select(a.id);
    left.editText();
    left.updateTextDraft("Local draft");
    const draft = left.getSnapshot().textEditing;
    right.select(b.id);
    right.nudgeSelection(10, 0);
    expect(left.getSnapshot().textEditing).toBe(draft);
    left.finishTextEditing();
    expect(left.getSnapshot().document.shapes[0]).toMatchObject({ label: { text: "Local draft" } });
  });

  it("preserves text geometry across editors with different font metrics and remote updates", () => {
    const text = {
      id: "text",
      type: "text" as const,
      x: 0,
      y: 0,
      width: 100,
      height: 37,
      text: "Canonical bounds",
      fontSize: 20,
      fontWeight: 400 as const,
      textAlign: "left" as const,
      color: "#243e33" as const,
    };
    const board = { ...createDocument(), shapes: [text] };
    const left = new Editor(board, undefined, () => 1);
    const right = new Editor(board, undefined, () => 1000);
    let operation!: SessionOperation;
    left.documentSession.subscribe((event) => {
      operation = event.operation!;
    });
    left.documentSession.execute(shapeTransaction("Move text", 0, text, { ...text, x: 50 }));
    right.applyExternal(operation);
    expect(right.getSnapshot().document).toEqual(left.getSnapshot().document);
    expect(right.getSnapshot().document.shapes[0]?.height).toBe(37);
  });

  it("protects the session itself during durable replacement and handles direct session replacement", () => {
    const { left, right } = pair();
    let operation!: SessionOperation;
    right.documentSession.subscribe((event) => {
      operation = event.operation!;
    });
    // Prepare before taking the lease; incoming accepted work must wait until it ends.
    operation = right.documentSession.prepare(shapeTransaction("Move A", 0, a, { ...a, x: 50 })!);
    const lock = left.lockDocument();
    expect(() => left.documentSession.apply(operation)).toThrow("replacement");
    expect(() =>
      left.documentSession.execute(shapeTransaction("Move A", 0, a, { ...a, x: 50 })),
    ).toThrow("replacement");
    lock.release();
    left.pan(10, 20);
    left.select(a.id);
    left.documentSession.replace(createDocument());
    expect(left.getSnapshot()).toMatchObject({
      document: createDocument(),
      selectedIds: [],
      camera: { x: 0, y: 0, zoom: 1 },
      canUndo: false,
    });
  });
});
