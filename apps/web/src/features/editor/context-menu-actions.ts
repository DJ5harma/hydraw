import { isFrame, PRESETS } from "@hydraw/document";
import type { Point } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import type { ContextMenuItem } from "./CanvasContextMenu.tsx";
import { canCutSelection, copyToClipboard, pasteFromClipboard } from "./clipboard-actions.ts";

type Options = {
  editor: Editor;
  point: Point;
  fit: () => void;
  exportImage: (format: "svg" | "png") => Promise<void>;
  copyImage?: () => Promise<void>;
};
export function contextMenuActions({
  editor,
  point,
  fit,
  exportImage,
  copyImage,
}: Options): readonly (readonly ContextMenuItem[])[] {
  const snapshot = editor.getSnapshot();
  const selected = new Set(snapshot.selectedIds);
  const objects = [...snapshot.document.shapes, ...snapshot.document.connectors].filter((item) =>
    selected.has(item.id),
  );
  const copy: ContextMenuItem = {
    id: "copy",
    label: "Copy",
    shortcut: "Ctrl/⌘ C",
    run: () => copyToClipboard(editor),
  };
  const imageCopy: ContextMenuItem[] = copyImage
    ? [{ id: "copy-image", label: "Copy as image", run: copyImage }]
    : [];
  const paste: ContextMenuItem = {
    id: "paste",
    label: "Paste",
    shortcut: "Ctrl/⌘ V",
    run: () => pasteFromClipboard(editor, point),
  };
  if (!objects.length)
    return [
      [paste],
      PRESETS.map((preset) => ({
        id: preset.id,
        label: `Insert ${preset.name.toLowerCase()}`,
        run: () => {
          editor.insertPreset(preset.id, point);
          fit();
        },
      })),
      [
        {
          id: "frame-tool",
          label: "Draw frame",
          shortcut: "F",
          run: () => editor.setShapeKind("frame"),
        },
        { id: "fit", label: "Fit board", run: fit },
      ],
    ];
  const locked = objects.some((item) => item.locked);
  if (locked)
    return [
      [
        {
          id: "unlock",
          label: "Unlock",
          shortcut: "Ctrl/⌘ Shift L",
          run: () => editor.setSelectionLocked(false),
        },
      ],
      [copy, ...imageCopy],
    ];
  const hasFrames = objects.some((item) => item.type !== "connector" && isFrame(item));
  const frame =
    objects.length === 1 && objects[0]!.type !== "connector" && isFrame(objects[0]!)
      ? objects[0]
      : undefined;
  const groups: ContextMenuItem[][] = [];
  if (frame)
    groups.push([
      {
        id: "rename",
        label: "Rename frame",
        shortcut: "Enter",
        run: () => editor.editText(frame.id),
      },
      { id: "fit", label: "Fit frame", run: fit },
      { id: "svg", label: "Export frame SVG", run: () => exportImage("svg") },
      { id: "png", label: "Export frame PNG", run: () => exportImage("png") },
    ]);
  groups.push([
    copy,
    ...imageCopy,
    ...(canCutSelection(editor)
      ? [
          {
            id: "cut",
            label: "Cut",
            shortcut: "Ctrl/⌘ X",
            run: () => copyToClipboard(editor, true),
          },
        ]
      : []),
    paste,
    {
      id: "duplicate",
      label: "Duplicate",
      shortcut: "Ctrl/⌘ D",
      run: () => editor.duplicateSelection(),
    },
  ]);
  const organize: ContextMenuItem[] = [];
  if (!hasFrames) {
    const oneGroup = objects.every((item) => item.groupId && item.groupId === objects[0]!.groupId);
    if (objects.length > 1 && !oneGroup)
      organize.push({
        id: "group",
        label: "Group",
        shortcut: "Ctrl/⌘ G",
        run: () => editor.groupSelection(),
      });
    if (objects.some((item) => item.groupId))
      organize.push({
        id: "ungroup",
        label: "Ungroup",
        shortcut: "Ctrl/⌘ Shift G",
        run: () => editor.ungroupSelection(),
      });
    organize.push({ id: "frame", label: "Frame selection", run: () => editor.frameSelection() });
  }
  if (organize.length) groups.push(organize);
  groups.push([
    {
      id: "front",
      label: "Bring to front",
      shortcut: "Ctrl/⌘ Shift ]",
      run: () => editor.orderSelection("front"),
    },
    {
      id: "forward",
      label: "Bring forward",
      shortcut: "Ctrl/⌘ ]",
      run: () => editor.orderSelection("forward"),
    },
    {
      id: "backward",
      label: "Send backward",
      shortcut: "Ctrl/⌘ [",
      run: () => editor.orderSelection("backward"),
    },
    {
      id: "back",
      label: "Send to back",
      shortcut: "Ctrl/⌘ Shift [",
      run: () => editor.orderSelection("back"),
    },
  ]);
  groups.push([
    {
      id: "lock",
      label: "Lock",
      shortcut: "Ctrl/⌘ Shift L",
      run: () => editor.setSelectionLocked(true),
    },
    {
      id: "delete",
      label: frame ? "Delete frame (keep contents)" : "Delete",
      shortcut: "Delete",
      danger: true,
      run: () => editor.removeSelection(),
    },
  ]);
  return groups;
}
