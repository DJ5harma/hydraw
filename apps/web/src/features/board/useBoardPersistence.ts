import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Editor } from "@hydraw/editor";
import { BoardPersistence } from "./persistence.ts";
import type { LocalBoard } from "./storage.ts";

export type { SaveState } from "./persistence.ts";

export function useBoardPersistence(
  editor: Editor,
  storage: LocalBoard | null,
  initialError: string | null,
) {
  const persistence = useMemo(
    () => new BoardPersistence(editor, storage, initialError),
    [editor, storage, initialError],
  );
  useEffect(() => persistence.connect(), [persistence]);
  const snapshot = useSyncExternalStore(persistence.subscribe, persistence.getSnapshot);
  return { ...snapshot, persistence };
}
