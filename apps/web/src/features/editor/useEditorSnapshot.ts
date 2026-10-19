import { useSyncExternalStore } from "react";
import type { Editor } from "@hydraw/editor";

/** Pointer previews and pan frames do not invalidate the controls snapshot. */
export function useEditorSnapshot(editor: Editor) {
  return useSyncExternalStore(editor.subscribe, editor.getChromeSnapshot);
}
