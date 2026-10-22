import { frameSelectionContents } from "@hydraw/document";
import { decodeClipboardFragment } from "@hydraw/editor";
import type { Editor } from "@hydraw/editor";
import type { Point } from "@hydraw/document";

export function canCutSelection(editor: Editor): boolean {
  const snapshot = editor.getSnapshot();
  const ids = new Set(frameSelectionContents(snapshot.document, snapshot.selectedIds));
  return (
    ids.size > 0 &&
    ![...snapshot.document.shapes, ...snapshot.document.connectors].some(
      (item) => ids.has(item.id) && item.locked,
    )
  );
}

/** Delete only after the clipboard write succeeds and the captured selection is still current. */
export async function copyToClipboard(editor: Editor, cut = false): Promise<void> {
  if (cut && !canCutSelection(editor))
    throw new Error("Unlock the selected objects and their contents before cutting.");
  const before = editor.getSnapshot();
  const text = editor.copySelection();
  if (!text) return;
  if (!navigator.clipboard?.writeText)
    throw new Error("Clipboard access is unavailable. Use Ctrl/⌘ C or X on the canvas.");
  await navigator.clipboard.writeText(text);
  if (!cut) return;
  const current = editor.getSnapshot();
  if (current.document !== before.document || current.selectedIds !== before.selectedIds)
    throw new Error(
      "The selection changed while copying. Objects were copied but kept on the board.",
    );
  editor.removeSelection(true);
}

export async function pasteFromClipboard(editor: Editor, screen: Point): Promise<void> {
  if (!navigator.clipboard?.readText)
    throw new Error("Clipboard access is unavailable. Use Ctrl/⌘ V on the canvas.");
  const before = editor.getSnapshot().camera;
  const world = { x: (screen.x - before.x) / before.zoom, y: (screen.y - before.y) / before.zoom };
  const text = await navigator.clipboard.readText();
  if (!decodeClipboardFragment(text))
    throw new Error("The clipboard does not contain copied Hydraw objects.");
  const camera = editor.getSnapshot().camera;
  editor.pasteSelection(text, {
    x: world.x * camera.zoom + camera.x,
    y: world.y * camera.zoom + camera.y,
  });
}
