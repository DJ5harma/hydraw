import { createDocument } from "@hydraw/document";
import { Editor } from "@hydraw/editor";
import { createTextMeasurer } from "@hydraw/editor/canvas";
import { localBoards } from "./storage.ts";
import { DEFAULT_BOARD_ID } from "./repository.ts";
import type { BoardLease } from "./repository.ts";

export type BoardSession = {
  id: string;
  editor: Editor;
  storage: BoardLease | null;
  error: string | null;
};

/** Acquire resources before publishing a session; every unsuccessful open releases storage. */
export async function openBoardSession(
  signal: AbortSignal,
  id = DEFAULT_BOARD_ID,
): Promise<BoardSession> {
  signal.throwIfAborted();
  const measure = createTextMeasurer();
  let storage: BoardLease | null = null;
  try {
    storage = await localBoards.open(id, signal);
    signal.throwIfAborted();
    return { id, editor: new Editor(storage.document, undefined, measure), storage, error: null };
  } catch (error) {
    storage?.close();
    signal.throwIfAborted();
    return {
      id,
      editor: new Editor(createDocument(), undefined, measure),
      storage: null,
      error: error instanceof Error ? error.message : "Local storage is unavailable.",
    };
  }
}
