import { useEffect, useState } from "react";
import type { Editor } from "@hydraw/editor";
import type { LocalBoard } from "./storage.ts";
export type SaveState = "idle" | "saving" | "saved" | "error";
export function useBoardPersistence(
  editor: Editor,
  storage: LocalBoard | null,
  initialError: string | null,
) {
  const [saveState, setSaveState] = useState<SaveState>(storage ? "idle" : "error");
  const [saveError, setSaveError] = useState<string | null>(initialError);
  useEffect(() => {
    if (!storage) return;
    let observedRevision = editor.getSnapshot().revision;
    let disposed = false;
    let chain = Promise.resolve();
    const unsubscribe = editor.subscribe(() => {
      const current = editor.getSnapshot();
      if (current.revision === observedRevision) return;
      observedRevision = current.revision;
      setSaveState("saving");
      chain = chain
        .then(async () => {
          await storage.save(current.document);
          if (!disposed && editor.getSnapshot().revision === current.revision) {
            setSaveState("saved");
            setSaveError(null);
          }
        })
        .catch((error: unknown) => {
          if (!disposed) {
            setSaveState("error");
            setSaveError(error instanceof Error ? error.message : "Local save failed.");
          }
        });
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [editor, storage]);

  return { saveState, saveError };
}
