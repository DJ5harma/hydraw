import { describe, expect, it } from "vite-plus/test";
import { createDocument } from "@hydraw/document";
import type { TextShape } from "@hydraw/document";
import { Editor, layoutText } from "./index.ts";
import { createTextLayouter } from "./text-layout.ts";

const measure = (text: string, style: { fontSize: number }) => (text.length * style.fontSize) / 2;
const text: TextShape = {
  id: "text-a",
  type: "text",
  x: 20,
  y: 30,
  width: 88,
  height: 36,
  text: "one two three",
  fontSize: 20,
  fontWeight: 400,
  textAlign: "left",
  color: "#243e33",
};
const setup = () => new Editor(createDocument(), () => "new-text", measure);

describe("owned text layout and editing", () => {
  it("centers command-created text at the screen anchor while retaining click placement", () => {
    const editor = setup();
    editor.zoomAt({ x: 0, y: 0 }, 2);
    editor.pan(20, 40);
    const anchor = { x: 300, y: 200 };
    editor.addText(anchor, "center");
    const centered = editor.getSnapshot().textEditing!.draft;
    expect(centered.x + centered.width / 2).toBe(140);
    expect(centered.y + centered.height / 2).toBeCloseTo(80);
    editor.cancelTextEditing();
    editor.addText(anchor);
    expect(editor.getSnapshot().textEditing!.draft).toMatchObject({ x: 140, y: 80 });
    expect(editor.getSnapshot().revision).toBe(0);
  });
  it("reuses unchanged text layouts and measures changed records with its own adapter", () => {
    let measurements = 0;
    const layout = createTextLayouter((value, style) => {
      measurements++;
      return measure(value, style);
    });
    const first = layout(text);
    const count = measurements;
    expect(count).toBeGreaterThan(0);
    expect(layout(text)).toBe(first);
    expect(measurements).toBe(count);
    const changed = { ...text, width: 200 };
    expect(layout(changed).lines).toEqual(["one two three"]);
    expect(measurements).toBeGreaterThan(count);
    expect(createTextLayouter(() => 1)(text).lines).toEqual(["one two three"]);
  });
  it("uses the selected font family for text measurements and keeps themed layouts separate", () => {
    const families = new Set<string>();
    const layout = createTextLayouter((value, style) => {
      families.add(style.fontFamily ?? "default");
      return measure(value, style);
    });
    const regular = layout(text, "Arial, sans-serif");
    const notebook = layout(text, "Georgia, serif");
    expect(regular).not.toBe(notebook);
    expect(families).toEqual(new Set(["Arial, sans-serif", "Georgia, serif"]));
    expect(layout(text, "Georgia, serif")).toBe(notebook);
  });
  it("wraps words, explicit blank lines and long Unicode tokens without breaking graphemes", () => {
    expect(layoutText(text, measure).lines).toEqual(["one two", "three"]);
    const shape = { ...text, width: 18, text: "👩‍💻\n\nx" };
    expect(layoutText(shape, () => 12).lines).toEqual(["👩‍💻", "", "x"]);
    expect(layoutText({ ...text, text: "abcdefghij", width: 38 }, measure).lines).toEqual([
      "abc",
      "def",
      "ghi",
      "j",
    ]);
  });

  it("keeps creation and edits transient until one commit, then round-trips history", () => {
    const editor = setup();
    editor.addText({ x: 60, y: 70 });
    editor.updateTextDraft("Architecture\nAPI → database");
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    expect(editor.getSnapshot().revision).toBe(0);
    editor.finishTextEditing();
    const original = editor.getSnapshot().document;
    expect(original.shapes[0]).toMatchObject({
      type: "text",
      text: "Architecture\nAPI → database",
      x: 60,
      y: 70,
    });
    expect(editor.getSnapshot().revision).toBe(1);
    editor.editText();
    editor.updateTextDraft("Changed");
    editor.updateTextDraft("Changed twice");
    editor.finishTextEditing();
    expect(editor.getSnapshot().revision).toBe(2);
    editor.undo();
    expect(editor.getSnapshot().document).toEqual(original);
    editor.undo();
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    editor.redo();
    expect(editor.getSnapshot().document).toEqual(original);
  });

  it("cancels drafts without touching history, discards empty creation and undoably deletes empty existing text", () => {
    const editor = setup();
    editor.addText({ x: 0, y: 0 });
    editor.finishTextEditing();
    expect(editor.getSnapshot().canUndo).toBe(false);
    editor.addText({ x: 0, y: 0 });
    editor.updateTextDraft("Original");
    editor.finishTextEditing();
    editor.editText();
    editor.updateTextDraft("Unsaved");
    editor.cancelTextEditing();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ text: "Original" });
    expect(editor.getSnapshot().revision).toBe(1);
    editor.editText();
    editor.updateTextDraft("");
    editor.finishTextEditing();
    expect(editor.getSnapshot().document.shapes).toHaveLength(0);
    editor.undo();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ text: "Original" });
  });

  it("reflows styled text and width changes, preserves the anchored edge, and rejects invalid edits", () => {
    const editor = new Editor({ ...createDocument(), shapes: [text] }, undefined, measure);
    editor.select(text.id);
    editor.setTextStyle({ fontWeight: 700, color: "#3568db", textAlign: "center" });
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({
      fontWeight: 700,
      color: "#3568db",
      textAlign: "center",
    });
    editor.setGeometry({ width: 48 });
    const shape = editor.getSnapshot().document.shapes[0]!;
    expect(shape.height).toBeGreaterThan(text.height);
    expect(editor.getResizeHandleAt({ x: shape.x, y: shape.y })).toBeNull();
    editor.begin({ x: shape.x, y: shape.y + shape.height / 2 });
    editor.move({ x: shape.x - 20, y: shape.y + shape.height / 2 });
    editor.finish();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ x: 0, width: 68 });
    const before = editor.getSnapshot();
    expect(() => editor.setTextStyle({ fontSize: 0 })).toThrow("invalid text");
    expect(editor.getSnapshot()).toBe(before);
    editor.editText();
    expect(() => editor.updateTextDraft("a".repeat(2001))).toThrow("at most");
    editor.cancelTextEditing();
  });

  it("recomputes imported text bounds before persistence and requires a measurement adapter", () => {
    const editor = setup();
    const imported = { ...createDocument(), shapes: [{ ...text, height: 1 }] };
    const prepared = editor.prepareDocument(imported);
    expect(prepared.shapes[0]?.height).toBe(layoutText(text, measure).height);
    expect(imported.shapes[0]?.height).toBe(1);
    const opened = new Editor(prepared, undefined, measure);
    expect(opened.getSnapshot().document).toEqual(prepared);
    expect(() => new Editor(prepared)).toThrow("measurement adapter");
  });

  it("commits a current draft before acquiring the replacement lease", () => {
    const editor = setup();
    editor.addText({ x: 0, y: 0 });
    editor.updateTextDraft("Keep me in recovery");
    const lease = editor.lockDocument();
    expect(editor.getSnapshot().document.shapes[0]).toMatchObject({ text: "Keep me in recovery" });
    expect(() => editor.addText({ x: 0, y: 0 })).toThrow("replacement");
    lease.release();
  });
});
