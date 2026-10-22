import { afterEach, expect, it, vi } from "vite-plus/test";
import { createDocument } from "@hydraw/document";
import { Editor, selectionBounds } from "@hydraw/editor";
import { copyToClipboard, pasteFromClipboard } from "./clipboard-actions.ts";

afterEach(() => vi.unstubAllGlobals());
function setup() {
  let id = 0;
  const editor = new Editor(
    createDocument(),
    () => `id-${++id}`,
    (text) => text.length * 10,
  );
  editor.insertPreset("request-flow", { x: 600, y: 350 });
  editor.frameSelection();
  return editor;
}
it("cuts a frame and its copied contents only after a successful clipboard write", async () => {
  const editor = setup();
  const before = editor.getSnapshot().document;
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  await copyToClipboard(editor, true);
  expect(writeText).toHaveBeenCalledOnce();
  expect(editor.getSnapshot().document.shapes).toEqual([]);
  expect(editor.getSnapshot().document.connectors).toEqual([]);
  editor.undo();
  expect(editor.getSnapshot().document).toEqual(before);
});
it("keeps objects intact when clipboard permission is denied", async () => {
  const editor = setup();
  const before = editor.getSnapshot().document;
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Permission denied")) },
  });
  await expect(copyToClipboard(editor, true)).rejects.toThrow("Permission denied");
  expect(editor.getSnapshot().document).toBe(before);
});
it("does not cut a different selection after a pending clipboard write resolves", async () => {
  const editor = setup();
  const before = editor.getSnapshot().document;
  let resolve!: () => void;
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    },
  });
  const pending = copyToClipboard(editor, true);
  editor.select(before.shapes[0]!.id);
  resolve();
  await expect(pending).rejects.toThrow("selection changed");
  expect(editor.getSnapshot().document).toBe(before);
});

it("pastes at the requested world location even if the camera pans during clipboard access", async () => {
  const editor = setup();
  const originalIds = new Set(
    [...editor.getSnapshot().document.shapes, ...editor.getSnapshot().document.connectors].map(
      (item) => item.id,
    ),
  );
  const fragment = editor.copySelection()!;
  let resolve!: (text: string) => void;
  vi.stubGlobal("navigator", {
    clipboard: {
      readText: () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    },
  });
  const pending = pasteFromClipboard(editor, { x: 900, y: 600 });
  editor.pan(100, 200);
  resolve(fragment);
  await pending;
  const snapshot = editor.getSnapshot();
  expect(snapshot.selectedIds.every((id) => !originalIds.has(id))).toBe(true);
  const bounds = selectionBounds(
    snapshot.document.shapes,
    snapshot.document.connectors,
    snapshot.selectedIds,
  )!;
  expect({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }).toEqual({
    x: 900,
    y: 600,
  });
});
